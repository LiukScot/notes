import { useState, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { DatabaseCell } from "./DatabaseCell";
import { DatabaseColumnHeader } from "./DatabaseColumnHeader";
import type { DatabaseProperty, DatabaseRowWithCells } from "@notes/shared";

interface DatabaseTableProps {
  isLocked?: boolean;
  properties: DatabaseProperty[];
  rows: DatabaseRowWithCells[];
  onCellChange: (rowId: string, propertyId: string, value: unknown) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
  onRenameProperty: (propertyId: string, name: string) => void;
  onDeleteProperty: (propertyId: string) => void;
  onReorderProperties: (propertyIds: string[]) => void;
}

export function DatabaseTable({
  isLocked = false,
  properties,
  rows,
  onCellChange,
  onAddRow,
  onDeleteRow,
  onRenameProperty,
  onDeleteProperty,
  onReorderProperties,
}: DatabaseTableProps) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const dragPropertyRef = useRef<string | null>(null);
  const resizeBaseRef = useRef<Record<string, number>>({});

  const getWidth = (propId: string) => columnWidths[propId] || 180;

  const gridTemplateColumns = [
    "40px", // row number column
    ...properties.map((p) => `${getWidth(p.id)}px`),
    "80px", // add column spacer
  ].join(" ");

  const handleResize = useCallback(
    (propertyId: string) => (delta: number) => {
      if (!resizeBaseRef.current[propertyId]) {
        resizeBaseRef.current[propertyId] = getWidth(propertyId);
      }
      const base = resizeBaseRef.current[propertyId];
      const newWidth = Math.max(80, base + delta);
      setColumnWidths((prev) => ({ ...prev, [propertyId]: newWidth }));
      // Reset base on next resize start (handled by mouseup in header)
      if (delta === 0) {
        resizeBaseRef.current[propertyId] = getWidth(propertyId);
      }
    },
    [columnWidths]
  );

  const handleDragStart = (propertyId: string) => (e: React.DragEvent) => {
    if (isLocked) return;
    dragPropertyRef.current = propertyId;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (targetPropertyId: string) => (e: React.DragEvent) => {
    if (isLocked) return;
    e.preventDefault();
    const sourceId = dragPropertyRef.current;
    if (!sourceId || sourceId === targetPropertyId) return;

    const ids = properties.map((p) => p.id);
    const sourceIdx = ids.indexOf(sourceId);
    const targetIdx = ids.indexOf(targetPropertyId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    ids.splice(sourceIdx, 1);
    ids.splice(targetIdx, 0, sourceId);
    onReorderProperties(ids);
    dragPropertyRef.current = null;
  };

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid min-w-full"
        style={{ gridTemplateColumns }}
      >
        {/* Header row */}
        <div
          className="border-b border-r px-2 py-1.5"
          style={{ borderColor: "var(--color-border)" }}
        />
        {properties.map((prop) => (
          <DatabaseColumnHeader
            key={prop.id}
            property={prop}
            isLocked={isLocked}
            onRename={(name) => onRenameProperty(prop.id, name)}
            onDelete={() => onDeleteProperty(prop.id)}
            onDragStart={handleDragStart(prop.id)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(prop.id)}
            onResize={handleResize(prop.id)}
          />
        ))}
        <div
          className="border-b px-2 py-1.5"
          style={{ borderColor: "var(--color-border)" }}
        />

        {/* Data rows */}
        {rows.map((row, rowIdx) => (
          <>
            <div
              key={`n-${row.id}`}
              className="group/row flex items-center border-b border-r px-2 py-0 text-xs"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              <span className="group-hover/row:hidden">{rowIdx + 1}</span>
              <button
                className="hidden rounded p-0.5 hover:opacity-70 group-hover/row:block disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: "var(--color-danger)" }}
                onClick={() => onDeleteRow(row.id)}
                disabled={isLocked}
              >
                ×
              </button>
            </div>
            {properties.map((prop) => (
              <div
                key={`${row.id}-${prop.id}`}
                className="border-b border-r"
                style={{ borderColor: "var(--color-border)" }}
              >
                <DatabaseCell
                  property={prop}
                  value={row.cells[prop.id]}
                  disabled={isLocked}
                  onChange={(value) => onCellChange(row.id, prop.id, value)}
                />
              </div>
            ))}
            <div
              key={`e-${row.id}`}
              className="border-b"
              style={{ borderColor: "var(--color-border)" }}
            />
          </>
        ))}
      </div>

      {/* Add row button */}
      <button
        onClick={onAddRow}
        className="hoverable flex w-full items-center gap-1 border-b px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          borderColor: "var(--color-border)",
          color: "var(--color-text-secondary)",
        }}
        disabled={isLocked}
      >
        <Plus size={14} />
        New row
      </button>
    </div>
  );
}
