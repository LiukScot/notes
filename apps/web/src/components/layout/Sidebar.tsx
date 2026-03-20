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
import type { PageTreeItem } from "@notes/shared";

export function Sidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const params = useParams({ strict: false });
  const activePageId = (params as any).pageId;

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

  const handleLogout = async () => {
    await api.auth.logout();
    useAppStore.getState().setUser(null);
    navigate({ to: "/login" });
  };

  const pages = data?.pages || [];
  const tree = useMemo(() => buildPageTree(pages), [pages]);

  return (
    <aside
      className="flex h-full w-60 flex-col border-r"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
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

      {/* Search placeholder */}
      <div className="px-2 py-2">
        <button
          className="hoverable flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <Search size={14} />
          Search
        </button>
      </div>

      {/* Page tree */}
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
            onSelect={(id) => navigate({ to: "/app/$pageId", params: { pageId: id } })}
            onCreateChild={(parentId) => createMutation.mutate(parentId)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}

        {pages.length === 0 && (
          <p className="px-2 py-4 text-center text-xs" style={{ color: "var(--color-text-secondary)" }}>
            No pages yet. Create one!
          </p>
        )}
      </div>

      {/* Footer */}
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
  depth = 0,
  onSelect,
  onCreateChild,
  onDelete,
}: {
  item: PageTreeItem;
  activePageId?: string;
  depth?: number;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = item.id === activePageId;
  const hasChildren = item.children.length > 0;

  return (
    <div>
      <div
        className={`group flex items-center rounded-md px-1 py-0.5 text-sm cursor-pointer transition-colors ${!isActive ? "hoverable" : ""}`}
        style={{
          paddingLeft: `${depth * 16 + 4}px`,
          backgroundColor: isActive ? "var(--color-bg-hover)" : "transparent",
          color: "var(--color-text)",
        }}
        onClick={() => onSelect(item.id)}
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
          <Table2 size={14} className={item.icon ? "hidden" : "mr-1.5 shrink-0"}
            style={{ color: "var(--color-text-secondary)" }} />
        ) : (
          <FileText size={14} className={item.icon ? "hidden" : "mr-1.5 shrink-0"}
            style={{ color: "var(--color-text-secondary)" }} />
        )}
        <span className="flex-1 truncate">{item.title || "Untitled"}</span>

        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="rounded p-0.5 hover:opacity-70"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(item.id);
            }}
            className="rounded p-0.5 hover:opacity-70"
            style={{ color: "var(--color-text-secondary)" }}
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
            depth={depth + 1}
            onSelect={onSelect}
            onCreateChild={onCreateChild}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

function buildPageTree(
  pages: Array<{
    id: string;
    parentPageId: string | null;
    title: string;
    icon: string | null;
    isDatabase: boolean;
  }>
): PageTreeItem[] {
  const map = new Map<string, PageTreeItem>();
  const roots: PageTreeItem[] = [];

  for (const p of pages) {
    map.set(p.id, {
      id: p.id,
      title: p.title,
      icon: p.icon,
      isDatabase: p.isDatabase,
      parentPageId: p.parentPageId,
      children: [],
    });
  }

  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parentPageId && map.has(p.parentPageId)) {
      map.get(p.parentPageId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
