/**
 * Tests for drop paths filtering utility
 *
 * @module utils/dropPaths.test
 */
import { describe, it, expect } from "vitest";
import { filterMarkdownPaths, MARKDOWN_EXTENSIONS } from "./dropPaths";

describe("MARKDOWN_EXTENSIONS", () => {
  it("includes common markdown extensions", () => {
    expect(MARKDOWN_EXTENSIONS).toContain(".md");
    expect(MARKDOWN_EXTENSIONS).toContain(".markdown");
    expect(MARKDOWN_EXTENSIONS).toContain(".txt");
  });
});

describe("filterMarkdownPaths", () => {
  it("returns empty array for empty input", () => {
    expect(filterMarkdownPaths([])).toEqual([]);
  });

  it("returns empty array for null or undefined paths", () => {
    expect(filterMarkdownPaths(null as unknown as string[])).toEqual([]);
    expect(filterMarkdownPaths(undefined as unknown as string[])).toEqual([]);
  });

  it("filters .md files", () => {
    const paths = ["/docs/readme.md", "/docs/style.css", "/docs/app.js"];
    expect(filterMarkdownPaths(paths)).toEqual(["/docs/readme.md"]);
  });

  it("filters .markdown files", () => {
    const paths = ["/docs/notes.markdown", "/docs/data.json"];
    expect(filterMarkdownPaths(paths)).toEqual(["/docs/notes.markdown"]);
  });

  it("filters .txt files", () => {
    const paths = ["/docs/todo.txt", "/docs/image.png"];
    expect(filterMarkdownPaths(paths)).toEqual(["/docs/todo.txt"]);
  });

  it("handles mixed valid and invalid extensions", () => {
    const paths = [
      "/docs/readme.md",
      "/docs/style.css",
      "/docs/notes.markdown",
      "/docs/image.png",
      "/docs/todo.txt",
    ];
    expect(filterMarkdownPaths(paths)).toEqual([
      "/docs/readme.md",
      "/docs/notes.markdown",
      "/docs/todo.txt",
    ]);
  });

  it("handles case-insensitive extensions", () => {
    const paths = ["/docs/README.MD", "/docs/notes.MARKDOWN", "/docs/TODO.TXT"];
    expect(filterMarkdownPaths(paths)).toEqual([
      "/docs/README.MD",
      "/docs/notes.MARKDOWN",
      "/docs/TODO.TXT",
    ]);
  });

  it("ignores files without extensions", () => {
    const paths = ["/docs/Makefile", "/docs/readme.md"];
    expect(filterMarkdownPaths(paths)).toEqual(["/docs/readme.md"]);
  });

  it("ignores hidden files with valid extensions", () => {
    const paths = ["/docs/.hidden.md", "/docs/visible.md"];
    // Both should be included - hidden files can still be markdown
    expect(filterMarkdownPaths(paths)).toEqual([
      "/docs/.hidden.md",
      "/docs/visible.md",
    ]);
  });

  it("handles Windows-style paths", () => {
    const paths = ["C:\\Users\\docs\\readme.md", "C:\\Users\\docs\\image.png"];
    expect(filterMarkdownPaths(paths)).toEqual(["C:\\Users\\docs\\readme.md"]);
  });
});
