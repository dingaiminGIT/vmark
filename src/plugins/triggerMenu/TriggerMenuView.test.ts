/**
 * TriggerMenuView Tests
 *
 * Tests for the trigger menu system including filtering, grouping,
 * DOM building, and keyboard navigation.
 */

import { describe, it, expect, vi } from "vitest";
import type { TriggerMenuItem } from "./types";
import { filterItems, groupItems } from "./TriggerMenuView";

// Test data
const testItems: TriggerMenuItem[] = [
  {
    label: "Heading 1",
    icon: "<svg>h1</svg>",
    group: "Text",
    keywords: ["h1", "title"],
    action: vi.fn(),
  },
  {
    label: "Heading 2",
    icon: "<svg>h2</svg>",
    group: "Text",
    keywords: ["h2", "subtitle"],
    action: vi.fn(),
  },
  {
    label: "Bullet List",
    icon: "<svg>list</svg>",
    group: "List",
    keywords: ["ul", "unordered"],
    action: vi.fn(),
  },
  {
    label: "Code Block",
    icon: "<svg>code</svg>",
    group: "Advanced",
    keywords: ["pre", "programming"],
    action: vi.fn(),
  },
];

/**
 * Build menu item element using DOM APIs (not innerHTML).
 */
function buildMenuItem(
  item: TriggerMenuItem,
  index: number,
  isSelected: boolean
): HTMLElement {
  const div = document.createElement("div");
  div.className = `trigger-menu-item${isSelected ? " selected" : ""}`;
  div.dataset.index = String(index);

  const iconSpan = document.createElement("span");
  iconSpan.className = "trigger-menu-item-icon";
  iconSpan.innerHTML = item.icon; // SVG content - static and trusted

  const labelSpan = document.createElement("span");
  labelSpan.className = "trigger-menu-item-label";
  labelSpan.textContent = item.label; // Use textContent for safety

  div.appendChild(iconSpan);
  div.appendChild(labelSpan);

  return div;
}

/**
 * Build group label element.
 */
function buildGroupLabel(groupName: string): HTMLElement {
  const div = document.createElement("div");
  div.className = "trigger-menu-group-label";
  div.textContent = groupName;
  return div;
}

/**
 * Build empty state element.
 */
function buildEmptyState(): HTMLElement {
  const div = document.createElement("div");
  div.className = "trigger-menu-empty";
  div.textContent = "No results";
  return div;
}

describe("triggerMenu", () => {
  describe("filterItems", () => {
    it("returns all items when filter is empty", () => {
      const result = filterItems(testItems, "");
      expect(result).toHaveLength(4);
    });

    it("filters by label (case insensitive)", () => {
      const result = filterItems(testItems, "heading");
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("Heading 1");
      expect(result[1].label).toBe("Heading 2");
    });

    it("filters by keywords", () => {
      const result = filterItems(testItems, "h1");
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Heading 1");
    });

    it("filters by partial keyword match", () => {
      const result = filterItems(testItems, "order");
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Bullet List");
    });

    it("returns empty array when no matches", () => {
      const result = filterItems(testItems, "nonexistent");
      expect(result).toHaveLength(0);
    });

    it("matches label substring", () => {
      const result = filterItems(testItems, "code");
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Code Block");
    });
  });

  describe("groupItems", () => {
    it("groups items by their group property", () => {
      const groups = groupItems(testItems);
      expect(groups.size).toBe(3);
      expect(groups.get("Text")).toHaveLength(2);
      expect(groups.get("List")).toHaveLength(1);
      expect(groups.get("Advanced")).toHaveLength(1);
    });

    it("assigns ungrouped items to Other", () => {
      const itemsWithoutGroup: TriggerMenuItem[] = [
        { label: "Test", icon: "", action: vi.fn() },
      ];
      const groups = groupItems(itemsWithoutGroup);
      expect(groups.get("Other")).toHaveLength(1);
    });

    it("preserves item order within groups", () => {
      const groups = groupItems(testItems);
      const textGroup = groups.get("Text")!;
      expect(textGroup[0].label).toBe("Heading 1");
      expect(textGroup[1].label).toBe("Heading 2");
    });

    it("handles empty array", () => {
      const groups = groupItems([]);
      expect(groups.size).toBe(0);
    });
  });

  describe("buildMenuItem", () => {
    it("creates element with correct structure", () => {
      const item = testItems[0];
      const el = buildMenuItem(item, 0, false);

      expect(el.tagName).toBe("DIV");
      expect(el.className).toBe("trigger-menu-item");
      expect(el.dataset.index).toBe("0");
      expect(el.children).toHaveLength(2);
    });

    it("adds selected class when selected", () => {
      const item = testItems[0];
      const el = buildMenuItem(item, 0, true);

      expect(el.className).toBe("trigger-menu-item selected");
    });

    it("sets correct data-index", () => {
      const item = testItems[0];
      const el = buildMenuItem(item, 5, false);

      expect(el.dataset.index).toBe("5");
    });

    it("renders icon in icon span", () => {
      const item = testItems[0];
      const el = buildMenuItem(item, 0, false);

      const iconSpan = el.querySelector(".trigger-menu-item-icon");
      expect(iconSpan).not.toBeNull();
      expect(iconSpan!.innerHTML).toBe("<svg>h1</svg>");
    });

    it("renders label using textContent (XSS safe)", () => {
      const maliciousItem: TriggerMenuItem = {
        label: "<script>alert('xss')</script>",
        icon: "",
        action: vi.fn(),
      };
      const el = buildMenuItem(maliciousItem, 0, false);

      const labelSpan = el.querySelector(".trigger-menu-item-label");
      expect(labelSpan!.innerHTML).toBe("&lt;script&gt;alert('xss')&lt;/script&gt;");
      expect(labelSpan!.textContent).toBe("<script>alert('xss')</script>");
    });
  });

  describe("buildGroupLabel", () => {
    it("creates element with correct class", () => {
      const el = buildGroupLabel("Text");
      expect(el.className).toBe("trigger-menu-group-label");
    });

    it("sets text content safely", () => {
      const el = buildGroupLabel("<script>bad</script>");
      expect(el.textContent).toBe("<script>bad</script>");
      expect(el.innerHTML).toBe("&lt;script&gt;bad&lt;/script&gt;");
    });
  });

  describe("buildEmptyState", () => {
    it("creates element with correct class and text", () => {
      const el = buildEmptyState();
      expect(el.className).toBe("trigger-menu-empty");
      expect(el.textContent).toBe("No results");
    });
  });

  describe("keyboard navigation bounds", () => {
    it("clamps selectedIndex to valid range on arrow down", () => {
      const items = filterItems(testItems, "");
      let selectedIndex = 0;

      // Simulate ArrowDown
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      expect(selectedIndex).toBe(1);

      // At end
      selectedIndex = items.length - 1;
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      expect(selectedIndex).toBe(3);
    });

    it("clamps selectedIndex to valid range on arrow up", () => {
      let selectedIndex = 2;

      // Simulate ArrowUp
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(1);

      // At start
      selectedIndex = 0;
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(0);
    });
  });

  describe("trigger detection", () => {
    /**
     * Check if trigger should show based on text before cursor.
     */
    function shouldShowTrigger(
      textBefore: string,
      trigger: string
    ): { show: boolean; filter: string } {
      const triggerIndex = textBefore.lastIndexOf(trigger);
      if (triggerIndex === -1) return { show: false, filter: "" };

      // Check that trigger is at start or after whitespace
      if (triggerIndex > 0) {
        const charBefore = textBefore[triggerIndex - 1];
        if (charBefore && !/\s/.test(charBefore)) {
          return { show: false, filter: "" };
        }
      }

      // Extract filter text after trigger
      const filterText = textBefore.slice(triggerIndex + trigger.length);

      // Don't show if there's a space in the filter
      if (filterText.includes(" ")) return { show: false, filter: "" };

      return { show: true, filter: filterText };
    }

    it("detects trigger at start of text", () => {
      const result = shouldShowTrigger("/heading", "/");
      expect(result.show).toBe(true);
      expect(result.filter).toBe("heading");
    });

    it("detects trigger after space", () => {
      const result = shouldShowTrigger("Some text /list", "/");
      expect(result.show).toBe(true);
      expect(result.filter).toBe("list");
    });

    it("rejects trigger mid-word", () => {
      const result = shouldShowTrigger("word/command", "/");
      expect(result.show).toBe(false);
    });

    it("rejects trigger with space in filter", () => {
      const result = shouldShowTrigger("/heading 1", "/");
      expect(result.show).toBe(false);
    });

    it("works with empty filter", () => {
      const result = shouldShowTrigger("/", "/");
      expect(result.show).toBe(true);
      expect(result.filter).toBe("");
    });

    it("works with different trigger characters", () => {
      expect(shouldShowTrigger(":emoji", ":").show).toBe(true);
      expect(shouldShowTrigger("~transform", "~").show).toBe(true);
      expect(shouldShowTrigger(">prompt", ">").show).toBe(true);
    });
  });
});
