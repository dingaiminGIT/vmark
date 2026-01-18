/**
 * Image Paste Toast Hook
 *
 * Initializes the image paste toast view once at app startup.
 */

import { useEffect } from "react";
import { initImagePasteToast, destroyImagePasteToast } from "@/plugins/imagePasteToast";

/**
 * Initialize the image paste toast view.
 * Call once in the main layout component.
 */
export function useImagePasteToast(): void {
  useEffect(() => {
    initImagePasteToast();
    return () => {
      destroyImagePasteToast();
    };
  }, []);
}
