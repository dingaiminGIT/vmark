/**
 * Tests for unified diagram cleanup registry.
 *
 * Covers registerCleanup (Set dedup), cleanupDescendants, sweepDetached,
 * and the test helpers _registrySize / _clearRegistry.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerCleanup,
  cleanupDescendants,
  sweepDetached,
  _registrySize,
  _clearRegistry,
} from "./diagramCleanup";

beforeEach(() => {
  _clearRegistry();
});

describe("registerCleanup", () => {
  it("registers a single callback", () => {
    const el = document.createElement("div");
    registerCleanup(el, vi.fn());
    expect(_registrySize()).toBe(1);
  });

  it("registers multiple callbacks for the same element", () => {
    const el = document.createElement("div");
    registerCleanup(el, vi.fn());
    registerCleanup(el, vi.fn());
    expect(_registrySize()).toBe(1); // One element entry
  });

  it("deduplicates the same callback reference", () => {
    const el = document.createElement("div");
    const fn = vi.fn();
    registerCleanup(el, fn);
    registerCleanup(el, fn);

    // Trigger cleanup — fn should only be called once
    cleanupDescendants(el);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("registers callbacks for separate elements", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    registerCleanup(a, vi.fn());
    registerCleanup(b, vi.fn());
    expect(_registrySize()).toBe(2);
  });
});

describe("cleanupDescendants", () => {
  it("runs callbacks for a directly registered element", () => {
    const el = document.createElement("div");
    const fn = vi.fn();
    registerCleanup(el, fn);

    cleanupDescendants(el);

    expect(fn).toHaveBeenCalledOnce();
    expect(_registrySize()).toBe(0);
  });

  it("cleans up nested descendants", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);

    const fn = vi.fn();
    registerCleanup(child, fn);

    cleanupDescendants(parent);

    expect(fn).toHaveBeenCalledOnce();
    expect(_registrySize()).toBe(0);
  });

  it("leaves unrelated elements untouched", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);

    const unrelated = document.createElement("div");
    const fnChild = vi.fn();
    const fnUnrelated = vi.fn();

    registerCleanup(child, fnChild);
    registerCleanup(unrelated, fnUnrelated);

    cleanupDescendants(parent);

    expect(fnChild).toHaveBeenCalledOnce();
    expect(fnUnrelated).not.toHaveBeenCalled();
    expect(_registrySize()).toBe(1); // unrelated remains
  });

  it("handles throwing callbacks gracefully", () => {
    const el = document.createElement("div");
    const throwing = vi.fn(() => { throw new Error("boom"); });
    const normal = vi.fn();
    registerCleanup(el, throwing);
    registerCleanup(el, normal);

    cleanupDescendants(el);

    expect(throwing).toHaveBeenCalledOnce();
    expect(normal).toHaveBeenCalledOnce();
    expect(_registrySize()).toBe(0);
  });

  it("is a no-op when parent has no registered descendants", () => {
    const parent = document.createElement("div");
    cleanupDescendants(parent); // should not throw
    expect(_registrySize()).toBe(0);
  });
});

describe("sweepDetached", () => {
  it("cleans up detached elements", () => {
    const el = document.createElement("div");
    // Not attached to document → isConnected === false
    const fn = vi.fn();
    registerCleanup(el, fn);

    sweepDetached();

    expect(fn).toHaveBeenCalledOnce();
    expect(_registrySize()).toBe(0);
  });

  it("preserves connected elements", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const fn = vi.fn();
    registerCleanup(el, fn);

    sweepDetached();

    expect(fn).not.toHaveBeenCalled();
    expect(_registrySize()).toBe(1);

    el.remove();
  });

  it("handles mixed connected and detached", () => {
    const connected = document.createElement("div");
    document.body.appendChild(connected);
    const detached = document.createElement("div");

    const fnConnected = vi.fn();
    const fnDetached = vi.fn();
    registerCleanup(connected, fnConnected);
    registerCleanup(detached, fnDetached);

    sweepDetached();

    expect(fnConnected).not.toHaveBeenCalled();
    expect(fnDetached).toHaveBeenCalledOnce();
    expect(_registrySize()).toBe(1);

    connected.remove();
  });

  it("handles throwing callbacks gracefully", () => {
    const el = document.createElement("div");
    const throwing = vi.fn(() => { throw new Error("boom"); });
    const normal = vi.fn();
    registerCleanup(el, throwing);
    registerCleanup(el, normal);

    sweepDetached();

    expect(throwing).toHaveBeenCalledOnce();
    expect(normal).toHaveBeenCalledOnce();
    expect(_registrySize()).toBe(0);
  });
});

describe("_clearRegistry", () => {
  it("empties the registry without calling callbacks", () => {
    const el = document.createElement("div");
    const fn = vi.fn();
    registerCleanup(el, fn);

    _clearRegistry();

    expect(fn).not.toHaveBeenCalled();
    expect(_registrySize()).toBe(0);
  });
});
