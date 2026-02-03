/**
 * Inline Source Peek Plugin
 *
 * Provides inline split view for editing markdown source of ProseMirror blocks.
 */

export {
  sourcePeekInlineExtension,
  sourcePeekInlinePluginKey,
  openSourcePeekInline,
  canUseSourcePeek,
  commitSourcePeek,
  revertAndCloseSourcePeek,
  EDITING_STATE_CHANGED,
} from "./tiptap";
