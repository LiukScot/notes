import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DatabaseTable } from "./DatabaseTable";
import {
  DatabaseToolbar,
  type SortConfig,
  type FilterConfig,
} from "./DatabaseToolbar";
import type { DatabaseRowWithCells, PropertyType } from "@notes/shared";

interface DatabaseViewProps {
  pageId: string;
}

export function DatabaseView({ pageId }: DatabaseViewProps) {
  const queryClient = useQueryClient();
  const queryKey = ["database", pageId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.databases.get(pageId),
  });

  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filter, setFilter] = useState<FilterConfig | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey });

  const addPropertyMutation = useMutation({
    mutationFn: (input: { name: string; type: PropertyType }) =>
      api.databases.createProperty(pageId, input),
    onSuccess: invalidate,
  });

  const renamePropertyMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.databases.updateProperty(pageId, id, { name }),
    onSuccess: invalidate,
  });

  const deletePropertyMutation = useMutation({
    mutationFn: (id: string) => api.databases.deleteProperty(pageId, id),
    onSuccess: invalidate,
  });

  const reorderPropertiesMutation = useMutation({
    mutationFn: (ids: string[]) => api.databases.reorderProperties(pageId, ids),
    onSuccess: invalidate,
  });

  const addRowMutation = useMutation({
    mutationFn: () => api.databases.createRow(pageId),
    onSuccess: invalidate,
  });

  const deleteRowMutation = useMutation({
    mutationFn: (rowId: string) => api.databases.deleteRow(pageId, rowId),
    onSuccess: invalidate,
  });

  const updateCellMutation = useMutation({
    mutationFn: ({
      rowId,
      propertyId,
      value,
    }: {
      rowId: string;
      propertyId: string;
      value: unknown;
    }) => api.databases.updateCell(pageId, rowId, propertyId, { value }),
    onSuccess: invalidate,
  });

  const properties = data?.properties || [];
  const rows = data?.rows || [];

  // Client-side sort & filter
  const processedRows = useMemo(() => {
    let result = [...rows];

    // Apply filter
    if (filter) {
      result = result.filter((row) => {
        const cellValue = row.cells[filter.propertyId];
        const strValue = String(cellValue ?? "").toLowerCase();
        const filterValue = filter.value.toLowerCase();

        switch (filter.operator) {
          case "contains":
            return strValue.includes(filterValue);
          case "equals":
            return strValue === filterValue;
          case "not_equals":
            return strValue !== filterValue;
          case "gt":
            return Number(cellValue) > Number(filter.value);
          case "lt":
            return Number(cellValue) < Number(filter.value);
          case "is_empty":
            return !cellValue && cellValue !== 0 && cellValue !== false;
          case "is_not_empty":
            return !!cellValue || cellValue === 0 || cellValue === false;
          default:
            return true;
        }
      });
    }

    // Apply sort
    if (sort) {
      const prop = properties.find((p) => p.id === sort.propertyId);
      if (prop) {
        result.sort((a, b) => {
          const aVal = a.cells[sort.propertyId];
          const bVal = b.cells[sort.propertyId];

          let cmp = 0;
          if (aVal == null && bVal == null) cmp = 0;
          else if (aVal == null) cmp = -1;
          else if (bVal == null) cmp = 1;
          else if (prop.type === "number") cmp = Number(aVal) - Number(bVal);
          else if (prop.type === "checkbox")
            cmp = Number(Boolean(aVal)) - Number(Boolean(bVal));
          else cmp = String(aVal).localeCompare(String(bVal));

          return sort.direction === "desc" ? -cmp : cmp;
        });
      }
    }

    return result;
  }, [rows, sort, filter, properties]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p style={{ color: "var(--color-text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <DatabaseToolbar
        properties={properties}
        sort={sort}
        filter={filter}
        onSortChange={setSort}
        onFilterChange={setFilter}
        onAddProperty={(name, type) =>
          addPropertyMutation.mutate({ name, type })
        }
      />
      <div
        className="rounded-md border"
        style={{ borderColor: "var(--color-border)" }}
      >
        <DatabaseTable
          properties={properties}
          rows={processedRows}
          onCellChange={(rowId, propertyId, value) =>
            updateCellMutation.mutate({ rowId, propertyId, value })
          }
          onAddRow={() => addRowMutation.mutate()}
          onDeleteRow={(rowId) => deleteRowMutation.mutate(rowId)}
          onRenameProperty={(propertyId, name) =>
            renamePropertyMutation.mutate({ id: propertyId, name })
          }
          onDeleteProperty={(propertyId) =>
            deletePropertyMutation.mutate(propertyId)
          }
          onReorderProperties={(ids) =>
            reorderPropertiesMutation.mutate(ids)
          }
        />
      </div>
    </div>
  );
}
