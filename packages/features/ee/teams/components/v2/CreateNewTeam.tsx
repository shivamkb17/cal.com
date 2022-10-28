import { useForm, Controller, useFormContext } from "react-hook-form";

import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import slugify from "@calcom/lib/slugify";
import { trpc } from "@calcom/trpc/react";
import { Icon } from "@calcom/ui";
import { Button, Avatar } from "@calcom/ui/v2";
import ImageUploader from "@calcom/ui/v2/core/ImageUploader";
import { Form, TextField } from "@calcom/ui/v2/core/form/fields";

import { NewTeamFormValues } from "../../lib/types";

const CreateANewTeamForm = (props: { nextStep: () => void }) => {
  const { t } = useLocale();
  const utils = trpc.useContext();

  const newTeamFormMethods = useForm<NewTeamFormValues>();

  // const createTeamMutation = trpc.useMutation("viewer.teams.create", {
  //   onSuccess(data) {
  //     utils.invalidateQueries(["viewer.teams.list"]);
  //     props.setTeamId(data.id);
  //     props.nextStep();
  //   },
  // });

  const validateTeamNameQuery = trpc.useQuery(
    ["viewer.teams.validateTeamName", { teamName: newTeamFormMethods.watch("name") }],
    {
      enabled: false,
      refetchOnWindowFocus: false,
    }
  );

  const validateTeamName = async () => {
    await validateTeamNameQuery.refetch();
    console.log(
      "🚀 ~ file: CreateNewTeam.tsx ~ line 40 ~ validateTeamName ~ validateTeamNameQuery.stats !== ",
      validateTeamNameQuery.data
    );

    return validateTeamNameQuery.data || t("team_name_taken");
  };

  return (
    <>
      <Form form={newTeamFormMethods} handleSubmit={(values) => console.log(values)}>
        <div className="mb-8">
          <Controller
            name="name"
            control={newTeamFormMethods.control}
            defaultValue=""
            rules={{
              validate: async () => validateTeamName(),
              required: t("must_enter_team_name"),
            }}
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <>
                <TextField
                  className="mt-2"
                  name="name"
                  label={t("team_name")}
                  value={value}
                  onChange={(e) => {
                    newTeamFormMethods.setValue("name", e?.target.value);
                    if (newTeamFormMethods.formState.touchedFields["slug"] === undefined) {
                      newTeamFormMethods.setValue("slug", slugify(e?.target.value));
                    }
                  }}
                  autoComplete="off"
                />
              </>
            )}
          />
        </div>

        <div className="mb-8">
          <Controller
            name="slug"
            control={newTeamFormMethods.control}
            render={({ field: { value } }) => (
              <TextField
                className="mt-2"
                name="slug"
                label={t("team_url")}
                addOnLeading={`${WEBAPP_URL}/team/`}
                value={value}
                onChange={(e) => {
                  newTeamFormMethods.setValue("slug", slugify(e?.target.value), { shouldTouch: true });
                }}
              />
            )}
          />
        </div>
        <div className="mb-8">
          <Controller
            control={newTeamFormMethods.control}
            name="avatar"
            render={({ field: { value } }) => (
              <div className="flex items-center">
                <Avatar alt="" imageSrc={value || null} gravatarFallbackMd5="newTeam" size="lg" />
                <div className="ml-4">
                  <ImageUploader
                    target="avatar"
                    id="avatar-upload"
                    buttonMsg={t("update")}
                    handleAvatarChange={(newAvatar: string) => {
                      newTeamFormMethods.setValue("avatar", newAvatar);
                    }}
                    imageSrc={value}
                  />
                </div>
              </div>
            )}
          />
        </div>
        <div className="flex space-x-2">
          <Button color="secondary" href="/settings" className="w-full justify-center">
            {t("cancel")}
          </Button>
          <Button
            color="primary"
            type="submit"
            // onClick={() => {
            //   console.log(newTeamFormMethods.getValues());
            //   props.nextStep();
            // }}
            EndIcon={Icon.FiArrowRight}
            className="w-full justify-center">
            {t("continue")}
          </Button>
        </div>

        {/* {createTeamMutation.isError && (
          <p className="mt-4 text-red-700">{createTeamMutation.error.message}</p>
        )} */}
      </Form>
    </>
  );
};

export default CreateANewTeamForm;
