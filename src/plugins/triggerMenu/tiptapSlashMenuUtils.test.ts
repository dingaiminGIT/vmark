import { describe, expect, it } from "vitest";
import { filterSlashMenuItems, groupSlashMenuItems, parseTrigger, type SlashMenuItem } from "./tiptapSlashMenuUtils";

describe("parseTrigger", () => {
  const triggerSlash = "// ";
  const triggerSemicolon = ";; ";
  const triggerComma = ",, ";

  it("matches bare trigger", () => {
    expect(parseTrigger(triggerSlash, triggerSlash)).toEqual({ query: "", triggerIndex: 0 });
    expect(parseTrigger(triggerSemicolon, triggerSemicolon)).toEqual({ query: "", triggerIndex: 0 });
    expect(parseTrigger(triggerComma, triggerComma)).toEqual({ query: "", triggerIndex: 0 });
  });

  it("matches trigger after whitespace", () => {
    expect(parseTrigger("hello // go", triggerSlash)).toEqual({ query: "go", triggerIndex: 6 });
    expect(parseTrigger("hello ;; go", triggerSemicolon)).toEqual({ query: "go", triggerIndex: 6 });
    expect(parseTrigger("hello ,, go", triggerComma)).toEqual({ query: "go", triggerIndex: 6 });
  });

  it("matches trigger inside a word", () => {
    expect(parseTrigger("hello// go", triggerSlash)).toEqual({ query: "go", triggerIndex: 5 });
    expect(parseTrigger("hello;; go", triggerSemicolon)).toEqual({ query: "go", triggerIndex: 5 });
    expect(parseTrigger("hello,, go", triggerComma)).toEqual({ query: "go", triggerIndex: 5 });
  });

  it("does not match when query contains whitespace", () => {
    expect(parseTrigger("// go now", triggerSlash)).toBeNull();
    expect(parseTrigger(";; go\tnow", triggerSemicolon)).toBeNull();
    expect(parseTrigger(",, go\nnow", triggerComma)).toBeNull();
  });

  it("matches custom triggers", () => {
    expect(parseTrigger("hello ;; go", triggerSemicolon)).toEqual({ query: "go", triggerIndex: 6 });
    expect(parseTrigger("x,, y", triggerComma)).toEqual({ query: "y", triggerIndex: 1 });
    expect(parseTrigger("x// y", triggerSlash)).toEqual({ query: "y", triggerIndex: 1 });
  });

  it("uses the last trigger when multiple are present", () => {
    expect(parseTrigger(";; one ;; two", triggerSemicolon)).toEqual({ query: "two", triggerIndex: 7 });
    expect(parseTrigger("// one // two", triggerSlash)).toEqual({ query: "two", triggerIndex: 7 });
  });

  it("returns null when the last trigger has whitespace in the query", () => {
    expect(parseTrigger(";; one ;; two words", triggerSemicolon)).toBeNull();
    expect(parseTrigger("// one // two words", triggerSlash)).toBeNull();
  });

  it("ignores noisy patterns for //", () => {
    expect(parseTrigger("http:// ", triggerSlash)).toBeNull();
    expect(parseTrigger("https:// ", triggerSlash)).toBeNull();
    expect(parseTrigger("file:// ", triggerSlash)).toBeNull();
    expect(parseTrigger("/// ", triggerSlash)).toBeNull();
    expect(parseTrigger("//// ", triggerSlash)).toBeNull();
  });

  it("ignores noisy patterns for ;;", () => {
    expect(parseTrigger(";;; ", triggerSemicolon)).toBeNull();
  });

  it("ignores noisy patterns for ,,", () => {
    expect(parseTrigger(",,, ", triggerComma)).toBeNull();
  });

  it("does not match when the trailing space is missing", () => {
    expect(parseTrigger("//", triggerSlash)).toBeNull();
    expect(parseTrigger(";;", triggerSemicolon)).toBeNull();
    expect(parseTrigger(",,", triggerComma)).toBeNull();
  });

  it("returns null when no trigger exists", () => {
    expect(parseTrigger("hello world", triggerSlash)).toBeNull();
    expect(parseTrigger("hello world", triggerSemicolon)).toBeNull();
    expect(parseTrigger("hello world", triggerComma)).toBeNull();
  });

  it("allows punctuation-heavy queries without whitespace", () => {
    expect(parseTrigger("// :)", triggerSlash)).toEqual({ query: ":)", triggerIndex: 0 });
    expect(parseTrigger(";; @todo", triggerSemicolon)).toEqual({ query: "@todo", triggerIndex: 0 });
    expect(parseTrigger(",, #tag", triggerComma)).toEqual({ query: "#tag", triggerIndex: 0 });
  });

  it("allows triggers after newlines", () => {
    expect(parseTrigger("line one\n// go", triggerSlash)).toEqual({ query: "go", triggerIndex: 9 });
    expect(parseTrigger("line one\n;; go", triggerSemicolon)).toEqual({ query: "go", triggerIndex: 9 });
    expect(parseTrigger("line one\n,, go", triggerComma)).toEqual({ query: "go", triggerIndex: 9 });
  });

  it("rejects when query contains any whitespace character", () => {
    expect(parseTrigger("// \t", triggerSlash)).toBeNull();
    expect(parseTrigger(";; \n", triggerSemicolon)).toBeNull();
    expect(parseTrigger(",, \r", triggerComma)).toBeNull();
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
