import type { DestinationCalendar } from "@prisma/client";
import type { TFunction } from "next-i18next";
import type { z } from "zod";

import { metadata as GoogleMeetMetadata } from "@calcom/app-store/googlevideo/_metadata";
import { MeetLocationType } from "@calcom/app-store/locations";
import EventManager from "@calcom/core/EventManager";
import monitorCallbackAsync from "@calcom/core/sentryWrapper";
import type { getAllCredentials } from "@calcom/features/bookings/lib/getAllCredentialsForUsersOnEvent/getAllCredentials";
import { refreshCredentials } from "@calcom/features/bookings/lib/getAllCredentialsForUsersOnEvent/refreshCredentials";
import { handleAppsStatus } from "@calcom/features/bookings/lib/handleNewBooking/handleAppsStatus";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import type { eventTypeAppMetadataOptionalSchema } from "@calcom/prisma/zod-utils";
import type { CalendarEvent } from "@calcom/types/Calendar";
import type { AdditionalInformation } from "@calcom/types/Calendar";

class BookingListener {
  static async create({
    evt,
    allCredentials,
    eventTypeApps,
    organizerUser,
    eventType,
    tOrganizer,
  }: {
    evt: CalendarEvent;
    allCredentials: Awaited<ReturnType<typeof getAllCredentials>>;
    eventTypeApps: z.infer<typeof eventTypeAppMetadataOptionalSchema>;
    organizerUser: { email: string; destinationCalendar: DestinationCalendar | null; username: string };
    eventType: { description: string };
    tOrganizer: TFunction;
  }) {
    const log = logger.getSubLogger({ prefix: ["[BookingListener.create]"] });

    // Handle apps & creating booking references
    const credentials = await monitorCallbackAsync(refreshCredentials, allCredentials);

    const eventManager = new EventManager({ ...organizerUser, credentials: allCredentials }, eventTypeApps);

    const { results, referencesToCreate } = await eventManager.create(evt);

    // TODO check if this is needed
    // if (evt.location) {
    //     booking.location = evt.location;
    // }

    // TODO check if this is needed
    // This gets overridden when creating the event - to check if notes have been hidden or not. We just reset this back
    // to the default description when we are sending the emails.
    // evt.description = eventType.description;

    const videoCallUrl = evt.videoCallData && evt.videoCallData.url ? evt.videoCallData.url : null;

    if (results.length > 0 && results.every((res) => !res.success)) {
      const error = {
        errorCode: "BookingCreatingMeetingFailed",
        message: "Booking failed",
      };

      log.error(
        `EventManager.create failure in some of the integrations ${organizerUser.username}`,
        safeStringify({ error, results })
      );
    } else {
      const additionalInformation: AdditionalInformation = {};

      if (results.length) {
        // Handle Google Meet results
        // We use the original booking location since the evt location changes to daily
        if (evt.location === MeetLocationType) {
          const googleMeetResult = {
            appName: GoogleMeetMetadata.name,
            type: "conferencing",
            uid: results[0].uid,
            originalEvent: results[0].originalEvent,
          };

          // Find index of google_calendar inside createManager.referencesToCreate
          const googleCalIndex = referencesToCreate.findIndex((ref) => ref.type === "google_calendar");
          const googleCalResult = results[googleCalIndex];

          if (!googleCalResult) {
            log.warn("Google Calendar not installed but using Google Meet as location");
            results.push({
              ...googleMeetResult,
              success: false,
              calWarnings: [tOrganizer("google_meet_warning")],
            });
          }

          if (googleCalResult?.createdEvent?.hangoutLink) {
            results.push({
              ...googleMeetResult,
              success: true,
            });

            // Add google_meet to referencesToCreate in the same index as google_calendar
            referencesToCreate[googleCalIndex] = {
              ...referencesToCreate[googleCalIndex],
              meetingUrl: googleCalResult.createdEvent.hangoutLink,
            };

            // Also create a new referenceToCreate with type video for google_meet
            referencesToCreate.push({
              type: "google_meet_video",
              meetingUrl: googleCalResult.createdEvent.hangoutLink,
              uid: googleCalResult.uid,
              credentialId: referencesToCreate[googleCalIndex].credentialId,
            });
          } else if (googleCalResult && !googleCalResult.createdEvent?.hangoutLink) {
            results.push({
              ...googleMeetResult,
              success: false,
            });
          }
        }
        // TODO: Handle created event metadata more elegantly
        additionalInformation.hangoutLink = results[0].createdEvent?.hangoutLink;
        additionalInformation.conferenceData = results[0].createdEvent?.conferenceData;
        additionalInformation.entryPoints = results[0].createdEvent?.entryPoints;
        evt.appsStatus = handleAppsStatus(results, booking, reqAppsStatus);
        videoCallUrl =
          additionalInformation.hangoutLink ||
          organizerOrFirstDynamicGroupMemberDefaultLocationUrl ||
          videoCallUrl;

        if (!isDryRun && evt.iCalUID !== booking.iCalUID) {
          // The eventManager could change the iCalUID. At this point we can update the DB record
          await prisma.booking.update({
            where: {
              id: booking.id,
            },
            data: {
              iCalUID: evt.iCalUID || booking.iCalUID,
            },
          });
        }
      }
      if (noEmail !== true) {
        let isHostConfirmationEmailsDisabled = false;
        let isAttendeeConfirmationEmailDisabled = false;

        isHostConfirmationEmailsDisabled =
          eventType.metadata?.disableStandardEmails?.confirmation?.host || false;
        isAttendeeConfirmationEmailDisabled =
          eventType.metadata?.disableStandardEmails?.confirmation?.attendee || false;

        if (isHostConfirmationEmailsDisabled) {
          isHostConfirmationEmailsDisabled = allowDisablingHostConfirmationEmails(workflows);
        }

        if (isAttendeeConfirmationEmailDisabled) {
          isAttendeeConfirmationEmailDisabled = allowDisablingAttendeeConfirmationEmails(workflows);
        }

        log.debug(
          "Emails: Sending scheduled emails for booking confirmation",
          safeStringify({
            calEvent: getPiiFreeCalendarEvent(evt),
          })
        );

        await monitorCallbackAsync(
          sendScheduledEmailsAndSMS,
          {
            ...evt,
            additionalInformation,
            additionalNotes,
            customInputs,
          },
          eventNameObject,
          isHostConfirmationEmailsDisabled,
          isAttendeeConfirmationEmailDisabled,
          eventType.metadata
        );
      }
    }
    // TODO - Apps
    // TODO - Emails
    // TODO - workflows
    // TODO - webhooks
  }
}

export default BookingListener;
