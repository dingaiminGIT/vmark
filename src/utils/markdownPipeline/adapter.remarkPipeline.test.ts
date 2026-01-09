/**
 * Adapter remark pipeline tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseMarkdown, serializeMarkdown, setUseRemarkPipeline } from "./adapter";
import { testSchema } from "./testSchema";

describe("adapter with remark pipeline", () => {
  beforeEach(() => {
    setUseRemarkPipeline(true);
  });

  afterEach(() => {
    setUseRemarkPipeline(false);
  });

  it("parses and serializes basic markdown", () => {
    const input = "# Title\n\nHello world";
    const doc = parseMarkdown(testSchema, input);
    const output = serializeMarkdown(testSchema, doc);
    expect(output).toContain("# Title");
    expect(output).toContain("Hello world");
  });

  it("round-trips inline math", () => {
    const input = "Formula: $E=mc^2$";
    const doc = parseMarkdown(testSchema, input);
    const output = serializeMarkdown(testSchema, doc);
    expect(output.trim()).toBe(input);
  });

  it("respects explicit remark option", () => {
    const doc = parseMarkdown(testSchema, "Hello", { useRemark: true });
    const output = serializeMarkdown(testSchema, doc, { useRemark: true });
    expect(output.trim()).toBe("Hello");
  });
});
