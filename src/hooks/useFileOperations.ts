import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useEditorStore } from "@/stores/editorStore";

async function saveToPath(path: string, content: string): Promise<boolean> {
  try {
    await writeTextFile(path, content);
    useEditorStore.getState().setFilePath(path);
    useEditorStore.getState().markSaved();
    return true;
  } catch (error) {
    console.error("Failed to save file:", error);
    return false;
  }
}

export function useFileOperations() {
  const handleNew = useCallback(async () => {
    useEditorStore.getState().reset();
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const path = await open({
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
      });
      if (path) {
        const content = await readTextFile(path);
        useEditorStore.getState().loadContent(content, path);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const { content, filePath } = useEditorStore.getState();
    if (filePath) {
      try {
        await writeTextFile(filePath, content);
        useEditorStore.getState().markSaved();
      } catch (error) {
        console.error("Failed to save file:", error);
      }
    } else {
      const path = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (path) {
        await saveToPath(path, content);
      }
    }
  }, []);

  const handleSaveAs = useCallback(async () => {
    const path = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (path) {
      const { content } = useEditorStore.getState();
      await saveToPath(path, content);
    }
  }, []);

  const handleClose = useCallback(async () => {
    useEditorStore.getState().reset();
  }, []);

  useEffect(() => {
    const unlisten: Promise<() => void>[] = [];

    unlisten.push(listen("menu:new", handleNew));
    unlisten.push(listen("menu:open", handleOpen));
    unlisten.push(listen("menu:save", handleSave));
    unlisten.push(listen("menu:save-as", handleSaveAs));
    unlisten.push(listen("menu:close", handleClose));

    return () => {
      Promise.all(unlisten).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleClose]);
}
