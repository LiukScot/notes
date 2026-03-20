import { useState, useRef, useEffect } from "react";
import { ArrowUpDown, Filter, Plus, X } from "lucide-react";
import type { DatabaseProperty, PropertyType } from "@notes/shared";

export interface SortConfig {
  propertyId: string;
  direction: "asc" | "desc";
}

export interface FilterConfig {
  propertyId: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "is_empty" | "is_not_empty";
  value: string;
}

interface DatabaseToolbarProps {
  properties: DatabaseProperty[];
  sort: SortConfig | null;
  filter: FilterConfig | null;
  onSortChange: (sort: SortConfig | null) => void;
  onFilterChange: (filter: FilterConfig | null) => void;
  onAddProperty: (name: string, type: PropertyType) => void;
}

export function DatabaseToolbar({
  properties,
  sort,
  filter,
  onSortChange,
  onFilterChange,
  onAddProperty,
}: DatabaseToolbarProps) {
  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showAddCol, setShowAddCol] = useState(false);

  return (
    <div className="flex items-center gap-1 px-1 py-1.5">
      {/* Sort */}
      <div className="relative">
        <button
          onClick={() => {
            setShowSort(!showSort);
            setShowFilter(false);
            setShowAddCol(false);
          }}
          className={`hoverable flex items-center gap-1 rounded-md px-2 py-1 text-xs ${sort ? "font-medium" : ""}`}
          style={{ color: sort ? "var(--color-primary)" : "var(--color-text-secondary)" }}
        >
          <ArrowUpDown size={13} />
          Sort
          {sort && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSortChange(null);
              }}
              className="ml-0.5 rounded-full p-0.5 hover:opacity-70"
            >
              <X size={10} />
            </button>
          )}
        </button>
        {showSort && (
          <Popover onClose={() => setShowSort(false)}>
            <SortPopover
              properties={properties}
              sort={sort}
              onSortChange={(s) => {
                onSortChange(s);
                setShowSort(false);
              }}
            />
          </Popover>
        )}
      </div>

      {/* Filter */}
      <div className="relative">
        <button
          onClick={() => {
            setShowFilter(!showFilter);
            setShowSort(false);
            setShowAddCol(false);
          }}
          className={`hoverable flex items-center gap-1 rounded-md px-2 py-1 text-xs ${filter ? "font-medium" : ""}`}
          style={{ color: filter ? "var(--color-primary)" : "var(--color-text-secondary)" }}
        >
          <Filter size={13} />
          Filter
          {filter && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange(null);
              }}
              className="ml-0.5 rounded-full p-0.5 hover:opacity-70"
            >
              <X size={10} />
            </button>
          )}
        </button>
        {showFilter && (
          <Popover onClose={() => setShowFilter(false)}>
            <FilterPopover
              properties={properties}
              filter={filter}
              onFilterChange={(f) => {
                onFilterChange(f);
                setShowFilter(false);
              }}
            />
          </Popover>
        )}
      </div>

      {/* Add column */}
      <div className="relative">
        <button
          onClick={() => {
            setShowAddCol(!showAddCol);
            setShowSort(false);
            setShowFilter(false);
          }}
          className="hoverable flex items-center gap-1 rounded-md px-2 py-1 text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <Plus size={13} />
          Column
        </button>
        {showAddCol && (
          <Popover onClose={() => setShowAddCol(false)}>
            <AddColumnPopover
              onAdd={(name, type) => {
                onAddProperty(name, type);
                setShowAddCol(false);
              }}
            />
          </Popover>
        )}
      </div>
    </div>
  );
}

function Popover({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border p-2 shadow-lg"
      style={{
        backgroundColor: "var(--color-bg)",
        borderColor: "var(--color-border)",
      }}
    >
      {children}
    </div>
  );
}

function SortPopover({
  properties,
  sort,
  onSortChange,
}: {
  properties: DatabaseProperty[];
  sort: SortConfig | null;
  onSortChange: (s: SortConfig | null) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
        Sort by
      </p>
      {properties.map((p) => (
        <button
          key={p.id}
          onClick={() =>
            onSortChange({
              propertyId: p.id,
              direction:
                sort?.propertyId === p.id && sort.direction === "asc"
                  ? "desc"
                  : "asc",
            })
          }
          className="hoverable flex w-full items-center justify-between rounded-sm px-2 py-1 text-sm"
          style={{
            color:
              sort?.propertyId === p.id
                ? "var(--color-primary)"
                : "var(--color-text)",
          }}
        >
          <span>{p.name}</span>
          {sort?.propertyId === p.id && (
            <span className="text-xs">{sort.direction === "asc" ? "A-Z" : "Z-A"}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function FilterPopover({
  properties,
  filter,
  onFilterChange,
}: {
  properties: DatabaseProperty[];
  filter: FilterConfig | null;
  onFilterChange: (f: FilterConfig | null) => void;
}) {
  const [propId, setPropId] = useState(filter?.propertyId || properties[0]?.id || "");
  const [op, setOp] = useState<FilterConfig["operator"]>(filter?.operator || "contains");
  const [val, setVal] = useState(filter?.value || "");

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
        Filter
      </p>
      <select
        value={propId}
        onChange={(e) => setPropId(e.target.value)}
        className="w-full rounded border bg-transparent px-2 py-1 text-sm"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={op}
        onChange={(e) => setOp(e.target.value as FilterConfig["operator"])}
        className="w-full rounded border bg-transparent px-2 py-1 text-sm"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
      >
        <option value="contains">Contains</option>
        <option value="equals">Equals</option>
        <option value="not_equals">Not equals</option>
        <option value="gt">Greater than</option>
        <option value="lt">Less than</option>
        <option value="is_empty">Is empty</option>
        <option value="is_not_empty">Is not empty</option>
      </select>
      {op !== "is_empty" && op !== "is_not_empty" && (
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Value..."
          className="w-full rounded border bg-transparent px-2 py-1 text-sm"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
      )}
      <div className="flex gap-1">
        <button
          onClick={() => onFilterChange({ propertyId: propId, operator: op, value: val })}
          className="rounded-md px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Apply
        </button>
        <button
          onClick={() => onFilterChange(null)}
          className="rounded-md px-3 py-1 text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
];

function AddColumnPopover({
  onAdd,
}: {
  onAdd: (name: string, type: PropertyType) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
        New column
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Column name"
        autoFocus
        className="w-full rounded border bg-transparent px-2 py-1 text-sm"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onAdd(name.trim(), type);
          }
        }}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as PropertyType)}
        className="w-full rounded border bg-transparent px-2 py-1 text-sm"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
      >
        {PROPERTY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (name.trim()) onAdd(name.trim(), type);
        }}
        disabled={!name.trim()}
        className="w-full rounded-md px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        Add
      </button>
    </div>
  );
}
