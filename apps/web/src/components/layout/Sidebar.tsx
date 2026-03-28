import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  Plus,
  FileText,
  Table2,
  ChevronRight,
  LogOut,
  PanelLeftClose,
  Search,
  Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { Page, PageTreeItem } from "@notes/shared";

export function Sidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const params = useParams({ strict: false });
  const activePageId = (params as { pageId?: string }).pageId;
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["pages"],
    queryFn: () => api.pages.list(),
  });

  const createMutation = useMutation({
    mutationFn: (parentPageId?: string) =>
      api.pages.create({ title: "Untitled", parentPageId }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      navigate({ to: "/app/$pageId", params: { pageId: result.page.id } });
    },
  });

  const createDatabaseMutation = useMutation({
    mutationFn: () => api.databases.create({ title: "Untitled Database" }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      navigate({ to: "/app/$pageId", params: { pageId: result.page.id } });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.pages.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      navigate({ to: "/app" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (input: { parentPageId: string | null; orderedPageIds: string[] }) =>
      api.pages.reorder(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });

  const handleLogout = async () => {
    await api.auth.logout();
    useAppStore.getState().setUser(null);
    navigate({ to: "/login" });
  };

  const pages = data?.pages || [];
  const pageMap = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const tree = useMemo(() => buildPageTree(pages), [pages]);

  const handleDrop = (targetId: string) => {
    const sourceId = dragPageId;
    setDropTargetId(null);
    setDragPageId(null);

    if (!sourceId || sourceId === targetId) return;

    const source = pageMap.get(sourceId);
    const target = pageMap.get(targetId);
    if (!source || !target || source.isLocked || target.isLocked) return;
    if (source.parentPageId !== target.parentPageId) return;

    const siblingIds = pages
      .filter((page) => page.parentPageId === target.parentPageId && !page.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
      .map((page) => page.id);

    const sourceIndex = siblingIds.indexOf(sourceId);
    const targetIndex = siblingIds.indexOf(targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    siblingIds.splice(sourceIndex, 1);
    siblingIds.splice(targetIndex, 0, sourceId);

    reorderMutation.mutate({
      parentPageId: target.parentPageId,
      orderedPageIds: siblingIds,
    });
  };

  return (
    <aside
      className="flex h-full w-60 flex-col border-r"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderColor: "var(--color-border)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {user?.name || "Notes"}
        </span>
        <button
          onClick={toggleSidebar}
          className="rounded p-1 transition-colors hover:opacity-70"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="px-2 py-2">
        <button
          className="hoverable flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <Search size={14} />
          Search
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-1">
        <div className="flex items-center justify-between px-2 py-1">
          <span
            className="text-xs font-medium uppercase"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Pages
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => createDatabaseMutation.mutate()}
              className="rounded p-0.5 transition-colors hover:opacity-70"
              style={{ color: "var(--color-text-secondary)" }}
              title="New database"
            >
              <Table2 size={14} />
            </button>
            <button
              onClick={() => createMutation.mutate(undefined)}
              className="rounded p-0.5 transition-colors hover:opacity-70"
              style={{ color: "var(--color-text-secondary)" }}
              title="New page"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {tree.map((item) => (
          <PageTreeNode
            key={item.id}
            item={item}
            activePageId={activePageId}
            dropTargetId={dropTargetId}
            onSelect={(id) => navigate({ to: "/app/$pageId", params: { pageId: id } })}
            onCreateChild={(parentId) => createMutation.mutate(parentId)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onDragStart={(id) => setDragPageId(id)}
            onDragEnter={(id) => {
              if (dragPageId && dragPageId !== id) {
                setDropTargetId(id);
              }
            }}
            onDragLeave={(id) => {
              if (dropTargetId === id) {
                setDropTargetId(null);
              }
            }}
            onDrop={handleDrop}
          />
        ))}

        {pages.length === 0 && (
          <p className="px-2 py-4 text-center text-xs" style={{ color: "var(--color-text-secondary)" }}>
            No pages yet. Create one!
          </p>
        )}
      </div>

      <div className="border-t px-3 py-2" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={handleLogout}
          className="hoverable flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>
    </aside>
  );
}

function PageTreeNode({
  item,
  activePageId,
  dropTargetId,
  depth = 0,
  onSelect,
  onCreateChild,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  item: PageTreeItem;
  activePageId?: string;
  dropTargetId?: string | null;
  depth?: number;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (targetId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = item.id === activePageId;
  const hasChildren = item.children.length > 0;
  const isDropTarget = dropTargetId === item.id;

  return (
    <div>
      <div
        className={`group flex items-center rounded-md px-1 py-0.5 text-sm transition-colors ${!isActive ? "hoverable" : ""} ${item.isLocked ? "opacity-80" : ""}`}
        style={{
          paddingLeft: `${depth * 16 + 4}px`,
          backgroundColor: isActive ? "var(--color-bg-hover)" : "transparent",
          color: "var(--color-text)",
          boxShadow: isDropTarget ? "inset 0 2px 0 var(--color-primary)" : "none",
        }}
        onClick={() => onSelect(item.id)}
        draggable={!item.isLocked}
        onDragStart={(event) => {
          if (item.isLocked) return;
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          onDragStart(item.id);
        }}
        onDragOver={(event) => {
          if (item.isLocked) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={(event) => {
          if (item.isLocked) return;
          event.preventDefault();
          onDragEnter(item.id);
        }}
        onDragLeave={() => onDragLeave(item.id)}
        onDrop={(event) => {
          if (item.isLocked) return;
          event.preventDefault();
          event.stopPropagation();
          onDrop(item.id);
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="mr-0.5 rounded p-0.5 hover:opacity-70"
          style={{
            color: "var(--color-text-secondary)",
            visibility: hasChildren ? "visible" : "hidden",
          }}
        >
          <ChevronRight
            size={12}
            style={{
              transform: expanded ? "rotate(90deg)" : "none",
              transition: "transform 0.15s",
            }}
          />
        </button>

        <span className="mr-1.5 text-base">{item.icon || ""}</span>
        {item.isDatabase ? (
          <Table2
            size={14}
            className={item.icon ? "hidden" : "mr-1.5 shrink-0"}
            style={{ color: "var(--color-text-secondary)" }}
          />
        ) : (
          <FileText
            size={14}
            className={item.icon ? "hidden" : "mr-1.5 shrink-0"}
            style={{ color: "var(--color-text-secondary)" }}
          />
        )}
        <span className="flex-1 truncate">{item.title || "Untitled"}</span>

        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="rounded p-0.5 hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: "var(--color-text-secondary)" }}
            disabled={item.isLocked}
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(item.id);
            }}
            className="rounded p-0.5 hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: "var(--color-text-secondary)" }}
            disabled={item.isLocked}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {expanded &&
        item.children.map((child) => (
          <PageTreeNode
            key={child.id}
            item={child}
            activePageId={activePageId}
            dropTargetId={dropTargetId}
            depth={depth + 1}
            onSelect={onSelect}
            onCreateChild={onCreateChild}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          />
        ))}
    </div>
  );
}

function buildPageTree(pages: Page[]): PageTreeItem[] {
  const map = new Map<string, PageTreeItem>();
  const roots: PageTreeItem[] = [];

  const sortedPages = [...pages].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt
  );

  for (const p of sortedPages) {
    map.set(p.id, {
      id: p.id,
      title: p.title,
      icon: p.icon,
      sortOrder: p.sortOrder,
      isLocked: p.isLocked,
      isDatabase: p.isDatabase,
      parentPageId: p.parentPageId,
      children: [],
    });
  }

  for (const p of sortedPages) {
    const node = map.get(p.id)!;
    if (p.parentPageId && map.has(p.parentPageId)) {
      map.get(p.parentPageId)!.children.push(node);
      map.get(p.parentPageId)!.children.sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
    } else {
      roots.push(node);
    }
  }

  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  return roots;
}
