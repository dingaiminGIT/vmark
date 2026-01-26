import { describe, it, expect } from "vitest";
import {
  resolveHardBreakStyle,
  resolveLineEndingOnSave,
  normalizeHardBreaks,
  normalizeLineEndings,
} from "./linebreaks";

describe("linebreaks helpers", () => {
  it("resolves hard break style from explicit preference", () => {
    // Explicit preference always wins, regardless of document style
    expect(resolveHardBreakStyle("unknown", "backslash")).toBe("backslash");
    expect(resolveHardBreakStyle("unknown", "twoSpaces")).toBe("twoSpaces");
    expect(resolveHardBreakStyle("twoSpaces", "backslash")).toBe("backslash");
    expect(resolveHardBreakStyle("backslash", "twoSpaces")).toBe("twoSpaces");
    expect(resolveHardBreakStyle("mixed", "backslash")).toBe("backslash");
    expect(resolveHardBreakStyle("mixed", "twoSpaces")).toBe("twoSpaces");
  });

  it("preserves detected document style when preference is preserve", () => {
    expect(resolveHardBreakStyle("twoSpaces", "preserve")).toBe("twoSpaces");
    expect(resolveHardBreakStyle("backslash", "preserve")).toBe("backslash");
  });

  it("defaults to twoSpaces for unknown/new documents (wider compatibility)", () => {
    expect(resolveHardBreakStyle("unknown", "preserve")).toBe("twoSpaces");
    expect(resolveHardBreakStyle("mixed", "preserve")).toBe("twoSpaces");
  });

  it("resolves line ending on save", () => {
    expect(resolveLineEndingOnSave("unknown", "lf")).toBe("lf");
    expect(resolveLineEndingOnSave("unknown", "crlf")).toBe("crlf");
    expect(resolveLineEndingOnSave("crlf", "preserve")).toBe("crlf");
    expect(resolveLineEndingOnSave("unknown", "preserve")).toBe("lf");
  });

  it("normalizes line endings to target", () => {
    expect(normalizeLineEndings("a\r\nb\rc\n", "lf")).toBe("a\nb\nc\n");
    expect(normalizeLineEndings("a\nb\n", "crlf")).toBe("a\r\nb\r\n");
  });

  it("normalizes hard breaks to two-space style", () => {
    const input = "a\\\nb\n";
    expect(normalizeHardBreaks(input, "twoSpaces")).toBe("a  \nb\n");
  });

  it("normalizes hard breaks to backslash style", () => {
    const input = "a  \nb\n";
    expect(normalizeHardBreaks(input, "backslash")).toBe("a\\\nb\n");
  });

  it("does not touch fenced code blocks", () => {
    const input = [
      "```",
      "code  ",
      "code\\",
      "```",
      "text  ",
    ].join("\n");

    expect(normalizeHardBreaks(input, "backslash")).toBe(
      ["```", "code  ", "code\\", "```", "text\\"].join("\n")
    );
  });
});
