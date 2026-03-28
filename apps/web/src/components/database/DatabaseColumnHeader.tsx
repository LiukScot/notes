import { useState, useRef, useEffect } from "react";
import {
  Type,
  Hash,
  List,
  ListChecks,
  Calendar,
  CheckSquare,
  GripVertical,
  Trash2,
} from "lucide-react";
import type { DatabaseProperty, PropertyType } from "@notes/shared";

const TYPE_ICONS: Record<PropertyType, typeof Type> = {
  text: Type,
  number: Hash,
  select: List,
  multi_select: ListChecks,
  date: Calendar,
  checkbox: CheckSquare,
};

interface DatabaseColumnHeaderProps {
  property: DatabaseProperty;
  isLocked?: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onResize: (delta: number) => void;
}

export function DatabaseColumnHeader({
  property,
  isLocked = false,
  onRename,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onResize,
}: DatabaseColumnHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(property.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(property.name);
  }, [property.name]);

  const commit = () => {
    setEditing(false);
    if (draft && draft !== property.name) {
      onRename(draft);
    } else {
      setDraft(property.name);
    }
  };

  const Icon = TYPE_ICONS[property.type as PropertyType] || Type;

  const handleResizeStart = (e: React.MouseEvent) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const onMouseMove = (ev: MouseEvent) => {
      onResize(ev.clientX - startX);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      className="group relative flex items-center border-r px-2 py-1.5"
      style={{ borderColor: "var(--color-border)" }}
      draggable={!isLocked}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <GripVertical
        size={12}
        className="mr-1 shrink-0 cursor-grab opacity-0 group-hover:opacity-50"
      />
      <Icon
        size={12}
        className="mr-1.5 shrink-0"
        style={{ color: "var(--color-text-secondary)" }}
      />
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(property.name);
              setEditing(false);
            }
          }}
          className="w-full min-w-0 border-none bg-transparent text-xs font-medium outline-none"
          style={{ color: "var(--color-text)" }}
        />
      ) : (
        <span
          className="flex-1 cursor-text truncate text-xs font-medium"
          style={{ color: "var(--color-text-secondary)" }}
          onDoubleClick={() => !isLocked && setEditing(true)}
        >
          {property.name}
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:opacity-70 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ color: "var(--color-text-secondary)" }}
        disabled={isLocked}
      >
        <Trash2 size={11} />
      </button>
      {/* Resize handle */}
      <div
        className={`absolute right-0 top-0 h-full w-1 ${isLocked ? "cursor-default" : "cursor-col-resize hover:bg-blue-500/50"}`}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
