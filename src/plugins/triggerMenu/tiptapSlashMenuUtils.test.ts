import { describe, expect, it } from "vitest";
import { filterSlashMenuItems, groupSlashMenuItems, parseSlashTrigger, type SlashMenuItem } from "./tiptapSlashMenuUtils";

describe("parseSlashTrigger", () => {
  it("matches bare slash", () => {
    expect(parseSlashTrigger("/")).toEqual({ query: "", slashIndex: 0 });
  });

  it("matches slash after whitespace", () => {
    expect(parseSlashTrigger("hello /he")).toEqual({ query: "he", slashIndex: 6 });
  });

  it("does not match slash inside a word", () => {
    expect(parseSlashTrigger("hello/")).toBeNull();
  });
});

describe("slash menu filtering", () => {
  const noop = () => {};

  const rootItems: SlashMenuItem[] = [
    {
      label: "Text",
      icon: "",
      group: "Text",
      children: [
        { label: "Paragraph", icon: "", action: noop },
        { label: "Heading 1", icon: "", keywords: ["h1", "title"], action: noop },
      ],
    },
    { label: "Divider", icon: "", group: "Other", action: noop },
  ];

  it("flattens leaf items and propagates groups", () => {
    const flat = filterSlashMenuItems(rootItems, "");
    expect(flat.map((i) => [i.label, i.group])).toEqual([
      ["Paragraph", "Text"],
      ["Heading 1", "Text"],
      ["Divider", "Other"],
    ]);
  });

  it("filters by label and keywords", () => {
    const filtered = filterSlashMenuItems(rootItems, "title");
    expect(filtered.map((i) => i.label)).toEqual(["Heading 1"]);
  });

  it("groups filtered items by group", () => {
    const flat = filterSlashMenuItems(rootItems, "");
    const groups = groupSlashMenuItems(flat);
    expect([...groups.keys()]).toEqual(["Text", "Other"]);
    expect(groups.get("Text")?.map((i) => i.label)).toEqual(["Paragraph", "Heading 1"]);
  });
});

