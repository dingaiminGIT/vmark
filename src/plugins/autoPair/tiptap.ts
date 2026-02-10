import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  isProseMirrorComposing,
  isProseMirrorInCompositionGrace,
  markProseMirrorCompositionEnd,
  isImeKeyEvent,
} from "@/utils/imeGuard";
import { handleTextInput, createKeyHandler, type AutoPairConfig } from "./handlers";

const autoPairPluginKey = new PluginKey("autoPair");

function getConfig(): AutoPairConfig {
  const settings = useSettingsStore.getState().markdown;
  return {
    enabled: settings.autoPairEnabled ?? true,
    includeCJK: settings.autoPairCJKStyle !== "off",
    includeCurlyQuotes: settings.autoPairCurlyQuotes ?? false,
    normalizeRightDoubleQuote:
      settings.autoPairCJKStyle !== "off" &&
      (settings.autoPairCurlyQuotes ?? false) &&
      (settings.autoPairRightDoubleQuote ?? false),
  };
}

/**
 * Check if IME composition is active or in grace period.
 * This prevents auto-pair from interfering with CJK input.
 */
function isComposingOrGrace(view: Parameters<typeof isProseMirrorComposing>[0]): boolean {
  return isProseMirrorComposing(view) || isProseMirrorInCompositionGrace(view);
}

export const autoPairExtension = Extension.create({
  name: "autoPair",
  addProseMirrorPlugins() {
    // Create key handler once — it reads config lazily via the getter
    const keyHandler = createKeyHandler(getConfig);

    return [
      new Plugin({
        key: autoPairPluginKey,
        props: {
          handleTextInput(view, from, to, text) {
            // Block during IME composition and grace period
            if (isComposingOrGrace(view)) return false;
            return handleTextInput(
              view as unknown as Parameters<typeof handleTextInput>[0],
              from,
              to,
              text,
              getConfig()
            );
          },
          // Use handleDOMEvents.keydown instead of handleKeyDown to intercept
          // Tab/Backspace before Tiptap's keyboard shortcuts (list indent, etc.)
          handleDOMEvents: {
            keydown(view, event) {
              // Block during IME composition, grace period, or IME key events
              if (isComposingOrGrace(view) || isImeKeyEvent(event)) return false;
              return keyHandler(view as unknown as Parameters<typeof keyHandler>[0], event);
            },
            compositionend(view) {
              // Mark composition end for grace period tracking
              markProseMirrorCompositionEnd(view);
              return false;
            },
          },
        },
      }),
    ];
  },
});
