import { describe, it, expect } from "vitest";
import { renderSvgBlock } from "./svgRender";

describe("renderSvgBlock", () => {
  it("returns content for valid minimal SVG", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
    expect(renderSvgBlock(svg)).toBe(svg);
  });

  it("returns content for SVG with viewBox", () => {
    const svg = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
    expect(renderSvgBlock(svg)).toBe(svg);
  });

  it("returns content for SVG starting with <?xml declaration", () => {
    const svg = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="0" x2="100" y2="100"/></svg>';
    expect(renderSvgBlock(svg)).toBe(svg);
  });

  it("trims whitespace and returns content", () => {
    const svg = '  <svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>  ';
    expect(renderSvgBlock(svg)).toBe(svg.trim());
  });

  it("returns null for invalid XML", () => {
    expect(renderSvgBlock("<svg><unclosed")).toBeNull();
  });

  it("returns null for non-SVG XML", () => {
    expect(renderSvgBlock("<div>not svg</div>")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(renderSvgBlock("")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(renderSvgBlock("   \n  ")).toBeNull();
  });

  it("returns null for plain text", () => {
    expect(renderSvgBlock("hello world")).toBeNull();
  });

  it("returns null for XML declaration without SVG root", () => {
    expect(renderSvgBlock('<?xml version="1.0"?><html><body>test</body></html>')).toBeNull();
  });
});
