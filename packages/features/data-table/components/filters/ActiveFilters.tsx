"use client";

import { type Table } from "@tanstack/react-table";
// eslint-disable-next-line no-restricted-imports
import startCase from "lodash/startCase";
import { Fragment } from "react";

import { Button, Popover, PopoverTrigger, PopoverContent, Icon } from "@calcom/ui";

import { useDataTable, useFilterableColumns } from "../../hooks";
import { FilterOptions } from "./FilterOptions";

interface ActiveFiltersProps<TData> {
  table: Table<TData>;
}

const filterIcons = {
  text: "file-text",
  number: "binary",
  multi_select: "layers",
  single_select: "disc",
} as const;

export function ActiveFilters<TData>({ table }: ActiveFiltersProps<TData>) {
  const { activeFilters } = useDataTable();
  const filterableColumns = useFilterableColumns(table);

  return (
    <>
      {activeFilters.map((filter) => {
        const column = filterableColumns.find((col) => col.id === filter.f);
        if (!column) return null;
        const icon = column.icon || filterIcons[column.type];
        return (
          <Popover key={column.id}>
            <PopoverTrigger asChild>
              <Button color="secondary">
                <Icon name={icon} className="mr-2 h-4 w-4" />
                {startCase(column.title)}
                <Icon name="chevron-down" className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <FilterOptions column={column} />
            </PopoverContent>
          </Popover>
        );
      })}
    </>
  );
}
