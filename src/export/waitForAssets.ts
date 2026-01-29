/**
 * Asset Stability Utilities
 *
 * Ensures all async content (fonts, images, Math, Mermaid) has rendered
 * before proceeding with export or print.
 */

export interface StabilityOptions {
  /** Maximum time to wait in milliseconds (default: 10000) */
  timeout?: number;
  /** Polling interval in milliseconds (default: 100) */
  interval?: number;
  /** Called with progress updates */
  onProgress?: (status: StabilityStatus) => void;
}

export interface StabilityStatus {
  fontsReady: boolean;
  imagesReady: boolean;
  mathReady: boolean;
  mermaidReady: boolean;
  allReady: boolean;
}

export interface StabilityResult {
  success: boolean;
  status: StabilityStatus;
  warnings: string[];
}

/**
 * Wait for all fonts to be loaded.
 */
async function waitForFonts(): Promise<boolean> {
  try {
    await document.fonts.ready;
    return true;
  } catch {
    // Font API not available in some environments
    return true;
  }
}

/**
 * Check if all images in a container have loaded.
 */
function checkImages(container: HTMLElement): { ready: boolean; pending: number } {
  const images = container.querySelectorAll("img");
  let pending = 0;

  for (const img of images) {
    if (!img.complete) {
      pending++;
    }
  }

  return { ready: pending === 0, pending };
}

/**
 * Wait for all images to load or error.
 */
function waitForImages(container: HTMLElement, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const images = Array.from(container.querySelectorAll("img"));
    if (images.length === 0) {
      resolve(true);
      return;
    }

    let loaded = 0;
    const total = images.length;
    const timeoutId = setTimeout(() => resolve(false), timeout);

    const checkDone = () => {
      loaded++;
      if (loaded >= total) {
        clearTimeout(timeoutId);
        resolve(true);
      }
    };

    for (const img of images) {
      if (img.complete) {
        checkDone();
      } else {
        img.addEventListener("load", checkDone, { once: true });
        img.addEventListener("error", checkDone, { once: true });
      }
    }
  });
}

/**
 * Check if Math (KaTeX) has finished rendering.
 * Looks for placeholder elements that indicate pending renders.
 */
function checkMathReady(container: HTMLElement): boolean {
  // Check for "Rendering math..." placeholders
  const placeholders = container.querySelectorAll(
    ".code-block-preview-placeholder"
  );

  for (const placeholder of placeholders) {
    const text = placeholder.textContent?.toLowerCase() ?? "";
    if (text.includes("rendering") || text.includes("math")) {
      return false;
    }
  }

  return true;
}

/**
 * Check if Mermaid diagrams have finished rendering.
 */
function checkMermaidReady(container: HTMLElement): boolean {
  // Check for loading placeholders
  const loading = container.querySelectorAll(".mermaid-loading");
  if (loading.length > 0) return false;

  // Check for error states (still considered "ready" — error is final state)
  // const errors = container.querySelectorAll(".mermaid-error");

  return true;
}

/**
 * Get current stability status for a container.
 */
export function getStabilityStatus(container: HTMLElement): StabilityStatus {
  const imagesCheck = checkImages(container);
  const fontsReady = document.fonts.status === "loaded";
  const imagesReady = imagesCheck.ready;
  const mathReady = checkMathReady(container);
  const mermaidReady = checkMermaidReady(container);

  return {
    fontsReady,
    imagesReady,
    mathReady,
    mermaidReady,
    allReady: fontsReady && imagesReady && mathReady && mermaidReady,
  };
}

/**
 * Wait for all assets in a container to be ready for export.
 *
 * This checks:
 * 1. Fonts are loaded
 * 2. All images have loaded or errored
 * 3. Math (KaTeX) has finished rendering
 * 4. Mermaid diagrams have finished rendering
 *
 * @param container - The DOM element containing the content
 * @param options - Configuration options
 * @returns Promise resolving to stability result
 *
 * @example
 * ```ts
 * const result = await waitForAssets(container, {
 *   timeout: 5000,
 *   onProgress: (status) => console.log(status),
 * });
 *
 * if (result.success) {
 *   // All assets ready, proceed with export
 * } else {
 *   // Some assets failed to load
 *   console.warn(result.warnings);
 * }
 * ```
 */
export async function waitForAssets(
  container: HTMLElement,
  options: StabilityOptions = {}
): Promise<StabilityResult> {
  const { timeout = 10000, interval = 100, onProgress } = options;

  const warnings: string[] = [];
  const startTime = Date.now();

  // Wait for fonts first
  await waitForFonts();

  // Poll for other assets
  return new Promise((resolve) => {
    const check = () => {
      const elapsed = Date.now() - startTime;
      const status = getStabilityStatus(container);

      onProgress?.(status);

      if (status.allReady) {
        // Extra frame for layout stability
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve({ success: true, status, warnings });
          });
        });
        return;
      }

      if (elapsed >= timeout) {
        // Timeout reached — report what's still pending
        if (!status.imagesReady) {
          const { pending } = checkImages(container);
          warnings.push(`${pending} image(s) did not load`);
        }
        if (!status.mathReady) {
          warnings.push("Some math blocks did not finish rendering");
        }
        if (!status.mermaidReady) {
          warnings.push("Some Mermaid diagrams did not finish rendering");
        }

        resolve({ success: false, status, warnings });
        return;
      }

      // Continue polling
      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Wait for images with a promise that resolves when all are loaded.
 * Useful for simpler cases where you only need image loading.
 */
export async function waitForAllImages(
  container: HTMLElement,
  timeout: number = 5000
): Promise<boolean> {
  return waitForImages(container, timeout);
}
