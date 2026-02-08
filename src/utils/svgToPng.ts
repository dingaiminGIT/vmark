/**
 * SVG to PNG Conversion
 *
 * Converts an SVG string to a PNG Uint8Array at a given scale.
 * Adds a solid background rect since SVG defaults to transparent.
 */

export async function svgToPngBytes(
  svgString: string,
  scale: number,
  bgColor: string,
): Promise<Uint8Array> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = doc.documentElement;

  const viewBox = svgEl.getAttribute("viewBox");
  let width: number;
  let height: number;
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    width = parts[2];
    height = parts[3];
  } else {
    width = parseFloat(svgEl.getAttribute("width") || "800");
    height = parseFloat(svgEl.getAttribute("height") || "600");
  }

  // Insert background rect as first child
  const bgRect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
  bgRect.setAttribute("width", "100%");
  bgRect.setAttribute("height", "100%");
  bgRect.setAttribute("fill", bgColor);
  svgEl.insertBefore(bgRect, svgEl.firstChild);

  // Ensure explicit dimensions (not %)
  svgEl.setAttribute("width", String(width));
  svgEl.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(svgEl);
  // Use data URL (not blob URL) to avoid tainting the canvas.
  // Blob URLs are treated as cross-origin in WebKit, which blocks toBlob().
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) {
            reject(new Error("Failed to create PNG"));
            return;
          }
          pngBlob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        },
        "image/png",
      );
    };
    img.onerror = () => {
      reject(new Error("Failed to load SVG"));
    };
    img.src = dataUrl;
  });
}
