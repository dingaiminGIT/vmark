/**
 * Adapter feature flag tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getUseRemarkPipeline, setUseRemarkPipeline } from "./adapter";

describe("adapter feature flag", () => {
  beforeEach(() => {
    setUseRemarkPipeline(false);
  });

  afterEach(() => {
    setUseRemarkPipeline(false);
  });

  it("defaults to markdown-it pipeline (false)", () => {
    expect(getUseRemarkPipeline()).toBe(false);
  });

  it("can enable remark pipeline", () => {
    setUseRemarkPipeline(true);
    expect(getUseRemarkPipeline()).toBe(true);
  });

  it("can disable remark pipeline", () => {
    setUseRemarkPipeline(true);
    setUseRemarkPipeline(false);
    expect(getUseRemarkPipeline()).toBe(false);
  });
});
