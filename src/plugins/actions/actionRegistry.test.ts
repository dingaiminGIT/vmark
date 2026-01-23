import { describe, it, expect } from "vitest";
import menuIds from "@shared/menu-ids.json";
import { MENU_TO_ACTION } from "./actionRegistry";

describe("actionRegistry", () => {
  it("maps all extracted menu IDs", () => {
    const mappedIds = new Set(
      Object.keys(MENU_TO_ACTION).map((key) => key.replace("menu:", ""))
    );

    const missing = menuIds.menuIds.filter((id) => !mappedIds.has(id));
    expect(missing).toEqual([]);
  });

  it("does not include extra menu mappings", () => {
    const mappedIds = new Set(
      Object.keys(MENU_TO_ACTION).map((key) => key.replace("menu:", ""))
    );
    const extras = [...mappedIds].filter((id) => !menuIds.menuIds.includes(id));
    expect(extras).toEqual([]);
  });
});
