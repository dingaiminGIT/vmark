import { describe, it, expect } from "vitest";
import { resolveSourceFormatShortcut } from "./shortcutUtils";

describe("resolveSourceFormatShortcut", () => {
  it("maps common keys to format actions", () => {
    expect(resolveSourceFormatShortcut("b")).toBe("bold");
    expect(resolveSourceFormatShortcut("i")).toBe("italic");
    expect(resolveSourceFormatShortcut("k")).toBe("link");
    expect(resolveSourceFormatShortcut("`")).toBe("code");
  });

  it("returns null for unsupported keys", () => {
    expect(resolveSourceFormatShortcut("x")).toBeNull();
  });
});
