import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { Editor } from "@/components/editor/Editor";
import { DatabaseView } from "@/components/database/DatabaseView";
import { PageChrome } from "@/components/page/PageChrome";
import type { UpdatePageInput } from "@notes/shared";

export const Route = createFileRoute("/app/$pageId")({
  component: PageView,
});

function PageView() {
  const { pageId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ["page", pageId],
    queryFn: () => api.pages.get(pageId),
  });

  const { data: pagesData } = useQuery({
    queryKey: ["pages"],
    queryFn: () => api.pages.list(),
  });

  const { data: blocksData, isLoading: blocksLoading } = useQuery({
    queryKey: ["blocks", pageId],
    queryFn: () => api.blocks.get(pageId),
  });

  const [title, setTitle] = useState("");
  const titleInitRef = useRef<string | null>(null);

  useEffect(() => {
    if (pageData?.page && titleInitRef.current !== pageId) {
      setTitle(pageData.page.title);
      titleInitRef.current = pageId;
    }
  }, [pageData?.page, pageId]);

  const invalidatePageData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pages"] }),
      queryClient.invalidateQueries({ queryKey: ["page", pageId] }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: (input: UpdatePageInput) => api.pages.update(pageId, input),
    onSuccess: invalidatePageData,
  });

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => api.pages.uploadCover(pageId, file),
    onSuccess: invalidatePageData,
  });

  const removeCoverMutation = useMutation({
    mutationFn: () => api.pages.removeCover(pageId),
    onSuccess: invalidatePageData,
  });

  const handleTitleBlur = () => {
    if (
      pageData?.page &&
      !pageData.page.isLocked &&
      title !== pageData.page.title
    ) {
      updateMutation.mutate({ title });
    }
  };

  if (pageLoading || blocksLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p style={{ color: "var(--color-text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  if (!pageData?.page) {
    return (
      <div className="flex h-full items-center justify-center">
        <p style={{ color: "var(--color-text-secondary)" }}>Page not found</p>
      </div>
    );
  }

  const page = pageData.page;
  const pages = pagesData?.pages || [page];

  return (
    <div
      className={`page-frame ${page.contentWidth === "wide" ? "page-frame-wide" : ""} ${fontClassName(page.fontFamily)}`}
    >
      <div className="mx-auto px-6 py-10 md:px-16">
        <PageChrome
          page={page}
          pages={pages}
          title={title}
          setTitle={setTitle}
          onTitleCommit={handleTitleBlur}
          onPatch={async (input) => {
            await updateMutation.mutateAsync(input);
          }}
          onUploadCover={async (file) => {
            await uploadCoverMutation.mutateAsync(file);
          }}
          onRemoveCover={async () => {
            await removeCoverMutation.mutateAsync();
          }}
        />

        {page.isDatabase ? (
          <DatabaseView pageId={pageId} isLocked={page.isLocked} />
        ) : (
          <Editor
            key={pageId}
            pageId={pageId}
            initialContent={blocksData?.content ?? null}
            editable={!page.isLocked}
          />
        )}
      </div>
    </div>
  );
}

function fontClassName(fontFamily: "default" | "serif" | "mono") {
  switch (fontFamily) {
    case "serif":
      return "page-font-serif";
    case "mono":
      return "page-font-mono";
    default:
      return "page-font-default";
  }
}
