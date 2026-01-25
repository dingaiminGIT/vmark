import { describe, it, expect } from "vitest";
import { getDisplayWidth, padToWidth } from "./stringWidth";

describe("stringWidth", () => {
  describe("getDisplayWidth", () => {
    it("returns 0 for empty string", () => {
      expect(getDisplayWidth("")).toBe(0);
    });

    it("counts ASCII characters as width 1", () => {
      expect(getDisplayWidth("hello")).toBe(5);
      expect(getDisplayWidth("abc123")).toBe(6);
      expect(getDisplayWidth(" ")).toBe(1);
      expect(getDisplayWidth("!@#$%")).toBe(5);
    });

    it("counts CJK Unified Ideographs as width 2", () => {
      // CJK Unified Ideographs (0x4e00-0x9fff)
      expect(getDisplayWidth("中")).toBe(2);
      expect(getDisplayWidth("中文")).toBe(4);
      expect(getDisplayWidth("你好")).toBe(4);
      expect(getDisplayWidth("漢字")).toBe(4);
    });

    it("counts CJK Extension A as width 2", () => {
      // CJK Extension A (0x3400-0x4dbf)
      // Using characters in this range
      expect(getDisplayWidth("㐀")).toBe(2); // U+3400
    });

    it("counts CJK Compatibility Ideographs as width 2", () => {
      // CJK Compatibility (0xf900-0xfaff)
      expect(getDisplayWidth("豈")).toBe(2); // U+F900
    });

    it("counts CJK Punctuation as width 2", () => {
      // CJK Punctuation (0x3000-0x303f)
      expect(getDisplayWidth("　")).toBe(2); // U+3000 Ideographic space
      expect(getDisplayWidth("。")).toBe(2); // U+3002 Ideographic full stop
      expect(getDisplayWidth("「」")).toBe(4); // CJK brackets
    });

    it("counts Fullwidth Forms as width 2", () => {
      // Fullwidth Forms (0xff00-0xffef)
      expect(getDisplayWidth("Ａ")).toBe(2); // U+FF21 Fullwidth A
      expect(getDisplayWidth("１")).toBe(2); // U+FF11 Fullwidth 1
      expect(getDisplayWidth("！")).toBe(2); // U+FF01 Fullwidth exclamation
    });

    it("handles mixed ASCII and CJK", () => {
      // "hello中文" = 5 (hello) + 4 (中文) = 9
      expect(getDisplayWidth("hello中文")).toBe(9);

      // "A中B文C" = 1 + 2 + 1 + 2 + 1 = 7
      expect(getDisplayWidth("A中B文C")).toBe(7);

      // "test123日本語" = 7 + 6 = 13
      expect(getDisplayWidth("test123日本語")).toBe(13);
    });

    it("handles multiline strings", () => {
      // Newline is ASCII width 1
      expect(getDisplayWidth("a\nb")).toBe(3);
      expect(getDisplayWidth("中\n文")).toBe(5);
    });

    it("handles emojis as width 1 (not in CJK ranges)", () => {
      // Emojis are not in the defined CJK ranges, so they get width 1
      // Note: This may not match visual width, but matches the function's definition
      expect(getDisplayWidth("😀")).toBe(1);
    });
  });

  describe("padToWidth", () => {
    it("adds no padding when string already meets target width", () => {
      expect(padToWidth("hello", 5)).toBe("hello");
      expect(padToWidth("hello", 3)).toBe("hello"); // Already exceeds
    });

    it("adds no padding when string exceeds target width", () => {
      expect(padToWidth("hello", 3)).toBe("hello");
      expect(padToWidth("中文", 2)).toBe("中文"); // Width is 4
    });

    it("adds spaces to reach target width for ASCII", () => {
      expect(padToWidth("hi", 5)).toBe("hi   ");
      expect(padToWidth("a", 4)).toBe("a   ");
      expect(padToWidth("", 3)).toBe("   ");
    });

    it("adds correct padding for CJK strings", () => {
      // "中" has width 2, pad to 5 needs 3 spaces
      expect(padToWidth("中", 5)).toBe("中   ");

      // "中文" has width 4, pad to 6 needs 2 spaces
      expect(padToWidth("中文", 6)).toBe("中文  ");
    });

    it("adds correct padding for mixed strings", () => {
      // "A中" has width 3, pad to 5 needs 2 spaces
      expect(padToWidth("A中", 5)).toBe("A中  ");

      // "hello中" has width 7, pad to 10 needs 3 spaces
      expect(padToWidth("hello中", 10)).toBe("hello中   ");
    });

    it("handles zero target width", () => {
      expect(padToWidth("hi", 0)).toBe("hi");
      expect(padToWidth("", 0)).toBe("");
    });

    it("handles negative target width", () => {
      // Math.max(0, negative) = 0, so no padding
      expect(padToWidth("hi", -5)).toBe("hi");
    });
  });
});
