import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { Block } from "@blocknote/core";

const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
function subscribeTheme(cb: () => void) {
  darkModeQuery.addEventListener("change", cb);
  return () => darkModeQuery.removeEventListener("change", cb);
}
function getTheme() {
  return darkModeQuery.matches ? "dark" as const : "light" as const;
}

interface EditorProps {
  pageId: string;
  initialContent: any[] | null;
}

export function Editor({ pageId, initialContent }: EditorProps) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageIdRef = useRef(pageId);
  pageIdRef.current = pageId;

  const editor = useCreateBlockNote({
    initialContent: initialContent && initialContent.length > 0
      ? (initialContent as any)
      : undefined,
  });

  const saveContent = useCallback(async () => {
    const doc = editor.document as Block[];
    try {
      await api.blocks.save(pageIdRef.current, doc);
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }, [editor]);

  // Debounced auto-save on changes
  const handleChange = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(saveContent, 1000);
  }, [saveContent]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveContent();
    };
  }, [saveContent]);

  return (
    <BlockNoteView
      editor={editor}
      onChange={handleChange}
      theme={theme}
    />
  );
}
