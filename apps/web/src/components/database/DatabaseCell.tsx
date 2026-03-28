import { useState, useRef, useEffect } from "react";
import type { DatabaseProperty } from "@notes/shared";

interface DatabaseCellProps {
  property: DatabaseProperty;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

export function DatabaseCell({ property, value, onChange, disabled = false }: DatabaseCellProps) {
  switch (property.type) {
    case "checkbox":
      return <CheckboxCell value={value} onChange={onChange} disabled={disabled} />;
    case "text":
      return <TextCell value={value} onChange={onChange} disabled={disabled} />;
    case "number":
      return <NumberCell value={value} onChange={onChange} disabled={disabled} />;
    case "date":
      return <DateCell value={value} onChange={onChange} disabled={disabled} />;
    case "select":
      return (
        <SelectCell
          value={value}
          onChange={onChange}
          options={getOptions(property)}
          disabled={disabled}
        />
      );
    case "multi_select":
      return (
        <MultiSelectCell
          value={value}
          onChange={onChange}
          options={getOptions(property)}
          disabled={disabled}
        />
      );
    default:
      return <TextCell value={value} onChange={onChange} disabled={disabled} />;
  }
}

function getOptions(property: DatabaseProperty): string[] {
  const config = property.config as Record<string, unknown> | null;
  if (config && Array.isArray(config.options)) {
    return config.options as string[];
  }
  return [];
}

function TextCell({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== String(value ?? "")) {
      onChange(draft);
    }
  };

  if (!editing) {
    return (
      <div
        className={`h-full w-full truncate px-2 py-1 text-sm ${disabled ? "" : "cursor-text"}`}
        onClick={() => !disabled && setEditing(true)}
      >
        {String(value ?? "")}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(String(value ?? ""));
          setEditing(false);
        }
      }}
      className="h-full w-full border-none bg-transparent px-2 py-1 text-sm outline-none"
      style={{ color: "var(--color-text)" }}
    />
  );
}

function NumberCell({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  const commit = () => {
    setEditing(false);
    const num = draft === "" ? null : Number(draft);
    if (num !== value) {
      onChange(num);
    }
  };

  if (!editing) {
    return (
      <div
        className={`h-full w-full truncate px-2 py-1 text-sm ${disabled ? "" : "cursor-text"}`}
        onClick={() => !disabled && setEditing(true)}
      >
        {value != null ? String(value) : ""}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(String(value ?? ""));
          setEditing(false);
        }
      }}
      className="h-full w-full border-none bg-transparent px-2 py-1 text-sm outline-none"
      style={{ color: "var(--color-text)" }}
    />
  );
}

function DateCell({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="h-full w-full border-none bg-transparent px-2 py-1 text-sm outline-none"
      style={{ color: "var(--color-text)" }}
    />
  );
}

function CheckboxCell({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex h-full w-full items-center px-2">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={`h-4 w-4 ${disabled ? "" : "cursor-pointer"}`}
      />
    </div>
  );
}

const SELECT_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
];

function getColorForOption(option: string, index: number) {
  return SELECT_COLORS[index % SELECT_COLORS.length];
}

function SelectCell({
  value,
  onChange,
  options,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  options: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = String(value ?? "");

  return (
    <div ref={ref} className="relative h-full w-full">
      <div
        className={`flex h-full w-full items-center px-2 py-1 ${disabled ? "" : "cursor-pointer"}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        {selected && (
          <span
            className={`inline-block rounded-sm px-1.5 py-0.5 text-xs font-medium ${getColorForOption(selected, options.indexOf(selected))}`}
          >
            {selected}
          </span>
        )}
      </div>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-md border p-1 shadow-lg"
          style={{
            backgroundColor: "var(--color-bg)",
            borderColor: "var(--color-border)",
          }}
        >
          {options.map((opt, i) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt === selected ? null : opt);
                setOpen(false);
              }}
              className="hoverable flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm"
              style={{ color: "var(--color-text)" }}
            >
              <span
                className={`inline-block rounded-sm px-1.5 py-0.5 text-xs font-medium ${getColorForOption(opt, i)}`}
              >
                {opt}
              </span>
            </button>
          ))}
          {options.length === 0 && (
            <p
              className="px-2 py-1 text-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              No options. Edit column config.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MultiSelectCell({
  value,
  onChange,
  options,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  options: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];

  const toggle = (opt: string) => {
    if (disabled) return;
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next);
  };

  return (
    <div ref={ref} className="relative h-full w-full">
      <div
        className={`flex h-full w-full flex-wrap items-center gap-1 px-2 py-1 ${disabled ? "" : "cursor-pointer"}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        {selected.map((s, i) => (
          <span
            key={s}
            className={`inline-block rounded-sm px-1.5 py-0.5 text-xs font-medium ${getColorForOption(s, options.indexOf(s))}`}
          >
            {s}
          </span>
        ))}
      </div>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-md border p-1 shadow-lg"
          style={{
            backgroundColor: "var(--color-bg)",
            borderColor: "var(--color-border)",
          }}
        >
          {options.map((opt, i) => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className="hoverable flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm"
              style={{ color: "var(--color-text)" }}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                readOnly
                className="h-3.5 w-3.5"
              />
              <span
                className={`inline-block rounded-sm px-1.5 py-0.5 text-xs font-medium ${getColorForOption(opt, i)}`}
              >
                {opt}
              </span>
            </button>
          ))}
          {options.length === 0 && (
            <p
              className="px-2 py-1 text-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              No options. Edit column config.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
