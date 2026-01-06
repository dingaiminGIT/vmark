import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { message } from "@tauri-apps/plugin-dialog";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { withReentryGuard } from "@/utils/reentryGuard";
import { getWindowLabel } from "@/utils/windowFocus";
import { saveImageToAssets, insertBlockImageNode } from "@/utils/imageUtils";

const imageHandlerPluginKey = new PluginKey("imageHandler");
const CLIPBOARD_IMAGE_GUARD = "clipboard-image";

function getActiveFilePathForCurrentWindow(): string | null {
  try {
    const windowLabel = getWindowLabel();
    const tabId = useTabStore.getState().activeTabId[windowLabel] ?? null;
    if (!tabId) return null;
    return useDocumentStore.getState().getDocument(tabId)?.filePath ?? null;
  } catch {
    return null;
  }
}

async function processClipboardImage(view: EditorView, item: DataTransferItem): Promise<void> {
  const windowLabel = getWindowLabel();

  await withReentryGuard(windowLabel, CLIPBOARD_IMAGE_GUARD, async () => {
    const filePath = getActiveFilePathForCurrentWindow();

    if (!filePath) {
      await message(
        "Please save the document first before pasting images. " +
          "Images are stored relative to the document location.",
        { title: "Unsaved Document", kind: "warning" }
      );
      return;
    }

    const file = item.getAsFile();
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const imageData = new Uint8Array(buffer);
    const filename = file.name || "clipboard-image.png";

    const relativePath = await saveImageToAssets(imageData, filename, filePath);

    insertBlockImageNode(view as unknown as Parameters<typeof insertBlockImageNode>[0], relativePath);
  });
}

function handlePaste(view: EditorView, event: ClipboardEvent): boolean {
  const items = event.clipboardData?.items;
  if (!items) return false;

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      event.preventDefault();
      processClipboardImage(view, item).catch((error) => {
        console.error("Failed to process clipboard image:", error);
        message("Failed to save image from clipboard.", { kind: "error" }).catch(console.error);
      });
      return true;
    }
  }

  return false;
}

export const imageHandlerExtension = Extension.create({
  name: "imageHandler",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: imageHandlerPluginKey,
        props: {
          handlePaste,
        },
      }),
    ];
  },
});

