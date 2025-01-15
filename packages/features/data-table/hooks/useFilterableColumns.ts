export function useFilterableColumns<TData>(table: Table<TData>) {
  const columns = useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table.getAllColumns()]
  );

  const filterableColumns = useMemo<FilterableColumn[]>(
    () =>
      columns
        .map((column) => {
          const type = column.columnDef.meta?.filter?.type || "multi_select";
          const base = {
            id: column.id,
            title: typeof column.columnDef.header === "string" ? column.columnDef.header : column.id,
            ...(column.columnDef.meta?.filter || {}),
            type,
          };
          if (type === "multi_select" || type === "single_select") {
            return {
              ...base,
              options: column.getFacetedUniqueValues(),
            };
          } else {
            return {
              ...base,
            };
          }
        })
        .filter((column): column is FilterableColumn => Boolean(column)),
    [columns]
  );

  return filterableColumns;
}
