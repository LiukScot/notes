import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ImagePlus, Settings2, SmilePlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Page, UpdatePageInput } from "@notes/shared";

interface PageChromeProps {
  page: Page;
  pages: Page[];
  title: string;
  setTitle: (title: string) => void;
  onTitleCommit: () => void;
  onPatch: (input: UpdatePageInput) => Promise<void>;
  onUploadCover: (file: File) => Promise<void>;
  onRemoveCover: () => Promise<void>;
}

export function PageChrome({
  page,
  pages,
  title,
  setTitle,
  onTitleCommit,
  onPatch,
  onUploadCover,
  onRemoveCover,
}: PageChromeProps) {
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState(page.coverImage && !page.coverImage.startsWith("/uploads/") ? page.coverImage : "");
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);

  useEffect(() => {
    if (page.coverImage && !page.coverImage.startsWith("/uploads/")) {
      setCoverUrl(page.coverImage);
    } else if (!page.coverImage) {
      setCoverUrl("");
    }
  }, [page.coverImage]);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(page, pages), [page, pages]);

  const applyCoverUrl = async () => {
    const trimmed = coverUrl.trim();
    if (!trimmed) {
      setCoverError("Enter an image URL.");
      return;
    }
    setCoverBusy(true);
    setCoverError(null);
    try {
      await onPatch({ coverImage: trimmed });
      setCoverDialogOpen(false);
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : "Failed to save cover URL.");
    } finally {
      setCoverBusy(false);
    }
  };

  const uploadCover = async (file: File | null) => {
    if (!file) return;
    setCoverBusy(true);
    setCoverError(null);
    try {
      await onUploadCover(file);
      setCoverDialogOpen(false);
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : "Failed to upload cover.");
    } finally {
      setCoverBusy(false);
    }
  };

  const removeCover = async () => {
    setCoverBusy(true);
    setCoverError(null);
    try {
      await onRemoveCover();
      setCoverDialogOpen(false);
      setCoverUrl("");
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : "Failed to remove cover.");
    } finally {
      setCoverBusy(false);
    }
  };

  return (
    <div className="page-shell">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.id} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight
                size={14}
                style={{ color: "var(--color-text-secondary)" }}
              />
            )}
            <Link
              to="/app/$pageId"
              params={{ pageId: crumb.id }}
              className="rounded px-1 py-0.5 no-underline transition-colors hoverable"
              style={{ color: index === breadcrumbs.length - 1 ? "var(--color-text)" : "var(--color-text-secondary)" }}
            >
              {crumb.title || "Untitled"}
            </Link>
          </span>
        ))}
      </nav>

      <Dialog.Root open={coverDialogOpen} onOpenChange={setCoverDialogOpen}>
        <div
          className={`page-cover group/cover mb-6 overflow-hidden rounded-3xl border ${page.coverImage ? "h-52" : "h-24 border-dashed"}`}
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: page.coverImage ? "var(--color-bg-secondary)" : "transparent",
          }}
        >
          {page.coverImage ? (
            <img src={page.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <Dialog.Trigger asChild disabled={page.isLocked}>
              <button
                className="page-empty-action flex h-full w-full items-center justify-center gap-2 rounded-3xl text-sm transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <ImagePlus size={16} />
                Add cover
              </button>
            </Dialog.Trigger>
          )}

          {page.coverImage && (
            <div className="page-cover-actions absolute inset-x-0 top-0 flex justify-end gap-2 p-3 opacity-0 transition-opacity group-hover/cover:opacity-100">
              <Dialog.Trigger asChild disabled={page.isLocked}>
                <button className="page-action-chip" type="button">
                  Change cover
                </button>
              </Dialog.Trigger>
              <button
                className="page-action-chip"
                type="button"
                disabled={page.isLocked || coverBusy}
                onClick={removeCover}
              >
                Remove cover
              </button>
            </div>
          )}
        </div>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-xl outline-none"
            style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
                  Cover image
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Paste an image URL or upload a local file.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="rounded p-1 hoverable" type="button" aria-label="Close cover dialog">
                  <X size={16} style={{ color: "var(--color-text-secondary)" }} />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Image URL
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(event) => setCoverUrl(event.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  disabled={page.isLocked || coverBusy}
                />
                <button
                  type="button"
                  onClick={applyCoverUrl}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: "var(--color-primary)" }}
                  disabled={page.isLocked || coverBusy}
                >
                  Save URL
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Upload image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={page.isLocked || coverBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void uploadCover(file);
                    event.currentTarget.value = "";
                  }}
                  className="block w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                />
              </div>

              {coverError && (
                <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                  {coverError}
                </p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Dialog.Root open={iconDialogOpen} onOpenChange={setIconDialogOpen} modal={false}>
            <div className="mb-2 inline-flex">
              <Dialog.Trigger asChild disabled={page.isLocked}>
                {page.icon ? (
                  <button
                    type="button"
                    disabled={page.isLocked}
                    className="rounded-2xl px-2 py-1 text-5xl transition-transform hover:scale-105 disabled:cursor-default"
                  >
                    {page.icon}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={page.isLocked}
                    className="page-empty-action inline-flex items-center gap-2 rounded-2xl border border-dashed px-3 py-2 text-sm transition-colors"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                  >
                    <SmilePlus size={16} />
                    Add icon
                  </button>
                )}
              </Dialog.Trigger>
            </div>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
              <Dialog.Content
                className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border shadow-xl outline-none"
                style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
                  <div>
                    <Dialog.Title className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
                      Page icon
                    </Dialog.Title>
                    <Dialog.Description className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                      Pick an emoji for this page.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button className="rounded p-1 hoverable" type="button" aria-label="Close icon dialog">
                      <X size={16} style={{ color: "var(--color-text-secondary)" }} />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="max-h-[70vh] overflow-auto">
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji: { native?: string }) => {
                      if (emoji.native) {
                        void onPatch({ icon: emoji.native });
                      }
                      setIconDialogOpen(false);
                    }}
                    theme="auto"
                    previewPosition="none"
                  />
                </div>

                {page.icon && (
                  <div className="border-t p-3" style={{ borderColor: "var(--color-border)" }}>
                    <button
                      type="button"
                      onClick={() => {
                        void onPatch({ icon: null });
                        setIconDialogOpen(false);
                      }}
                      className="flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm"
                      style={{ color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg-secondary)" }}
                    >
                      Remove icon
                    </button>
                  </div>
                )}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={onTitleCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            placeholder="Untitled"
            disabled={page.isLocked}
            className="mb-2 w-full border-none bg-transparent text-4xl font-bold outline-none disabled:cursor-default disabled:opacity-80"
            style={{ color: "var(--color-text)" }}
          />
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="page-action-chip mt-2 inline-flex items-center gap-2"
              aria-label="Page settings"
            >
              <Settings2 size={16} />
              Settings
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={8}
              align="end"
              className="z-30 min-w-56 rounded-2xl border p-2 shadow-xl"
              style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
            >
              <DropdownMenu.Label className="px-2 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
                Font
              </DropdownMenu.Label>
              {[
                ["default", "Default"],
                ["serif", "Serif"],
                ["mono", "Mono"],
              ].map(([value, label]) => (
                <DropdownMenu.Item
                  key={value}
                  disabled={page.isLocked}
                  onSelect={() => {
                    void onPatch({ fontFamily: value as Page["fontFamily"] });
                  }}
                  className="rounded-xl px-2 py-2 text-sm outline-none data-[highlighted]:bg-[var(--color-bg-hover)]"
                  style={{ color: page.fontFamily === value ? "var(--color-primary)" : "var(--color-text)" }}
                >
                  {label}
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="my-2 h-px" style={{ backgroundColor: "var(--color-border)" }} />
              <DropdownMenu.Label className="px-2 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
                Width
              </DropdownMenu.Label>
              {[
                ["normal", "Normal width"],
                ["wide", "Wide width"],
              ].map(([value, label]) => (
                <DropdownMenu.Item
                  key={value}
                  disabled={page.isLocked}
                  onSelect={() => {
                    void onPatch({ contentWidth: value as Page["contentWidth"] });
                  }}
                  className="rounded-xl px-2 py-2 text-sm outline-none data-[highlighted]:bg-[var(--color-bg-hover)]"
                  style={{ color: page.contentWidth === value ? "var(--color-primary)" : "var(--color-text)" }}
                >
                  {label}
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="my-2 h-px" style={{ backgroundColor: "var(--color-border)" }} />
              <DropdownMenu.Item
                onSelect={() => {
                  void onPatch({ isLocked: !page.isLocked });
                }}
                className="rounded-xl px-2 py-2 text-sm outline-none data-[highlighted]:bg-[var(--color-bg-hover)]"
                style={{ color: page.isLocked ? "var(--color-danger)" : "var(--color-text)" }}
              >
                {page.isLocked ? "Unlock editing" : "Lock editing"}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

function buildBreadcrumbs(page: Page, pages: Page[]) {
  const byId = new Map(pages.map((entry) => [entry.id, entry]));
  const crumbs: Page[] = [];
  let current: Page | undefined = page;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    crumbs.unshift(current);
    seen.add(current.id);
    current = current.parentPageId ? byId.get(current.parentPageId) : undefined;
  }

  return crumbs;
}
