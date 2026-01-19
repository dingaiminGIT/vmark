/**
 * Visual indicator shown when images are dragged over the editor.
 *
 * Shows an overlay with a dashed border and icon to indicate
 * that images can be dropped to insert them into the document.
 *
 * @module components/Editor/DropZoneIndicator
 */

import { useDropZoneStore } from "@/stores/dropZoneStore";

export function DropZoneIndicator() {
  const isDragging = useDropZoneStore((state) => state.isDragging);
  const hasImages = useDropZoneStore((state) => state.hasImages);
  const imageCount = useDropZoneStore((state) => state.imageCount);

  if (!isDragging || !hasImages) {
    return null;
  }

  return (
    <div className="drop-zone-indicator">
      <div className="drop-zone-content">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span className="drop-zone-text">
          {imageCount === 1
            ? "Drop to insert image"
            : `Drop to insert ${imageCount} images`}
        </span>
      </div>
    </div>
  );
}
