import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { Editor } from "@/components/editor/Editor";
import { DatabaseView } from "@/components/database/DatabaseView";

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

  const updateMutation = useMutation({
    mutationFn: (newTitle: string) =>
      api.pages.update(pageId, { title: newTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });

  const handleTitleBlur = () => {
    if (pageData?.page && title !== pageData.page.title) {
      updateMutation.mutate(title);
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:px-16">
      {pageData.page.icon && (
        <div className="mb-1 text-4xl">{pageData.page.icon}</div>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="Untitled"
        className="mb-4 w-full border-none bg-transparent text-4xl font-bold outline-none"
        style={{ color: "var(--color-text)" }}
      />
      {pageData.page.isDatabase ? (
        <DatabaseView pageId={pageId} />
      ) : (
        <Editor
          key={pageId}
          pageId={pageId}
          initialContent={blocksData?.content ?? null}
        />
      )}
    </div>
  );
}
