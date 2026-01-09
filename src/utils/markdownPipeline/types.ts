/**
 * Types for the markdown pipeline
 *
 * Re-exports MDAST types and defines custom types for VMark extensions.
 *
 * @module utils/markdownPipeline/types
 */

// Re-export standard MDAST types
export type {
  Root,
  Content,
  Paragraph,
  Heading,
  ThematicBreak,
  Blockquote,
  List,
  ListItem,
  Code,
  Html,
  Text,
  Emphasis,
  Strong,
  Delete,
  InlineCode,
  Link,
  Image,
  Table,
  TableRow,
  TableCell,
  Break,
  Definition,
  FootnoteDefinition,
  FootnoteReference,
} from "mdast";

// Re-export math types from mdast-util-math (added by remark-math)
export type { Math, InlineMath } from "mdast-util-math";

// Frontmatter type from remark-frontmatter
export interface Yaml {
  type: "yaml";
  value: string;
}

// Custom inline types for VMark
export interface Subscript {
  type: "subscript";
  children: PhrasingContent[];
}

export interface Superscript {
  type: "superscript";
  children: PhrasingContent[];
}

export interface Highlight {
  type: "highlight";
  children: PhrasingContent[];
}

export interface Underline {
  type: "underline";
  children: PhrasingContent[];
}

// Wiki link types
export interface WikiLink {
  type: "wikiLink";
  value: string; // The page name
  alias?: string; // Optional display alias
  data?: {
    permalink?: string;
    hProperties?: Record<string, unknown>;
  };
}

export interface WikiEmbed {
  type: "wikiEmbed";
  value: string; // The embedded resource path
  alias?: string;
}

// Union type for all phrasing (inline) content
// Note: mdast PhrasingContent already includes InlineMath via mdast-util-math augmentation
export type PhrasingContent =
  | import("mdast").PhrasingContent
  | Subscript
  | Superscript
  | Highlight
  | Underline
  | WikiLink;

// Union type for all block content
// Note: mdast BlockContent already includes Math via mdast-util-math augmentation
export type BlockContent =
  | import("mdast").BlockContent
  | Yaml
  | WikiEmbed;

// Augment MDAST module for custom VMark types
// Note: math and inlineMath are already augmented by mdast-util-math
declare module "mdast" {
  interface RootContentMap {
    yaml: Yaml;
    wikiEmbed: WikiEmbed;
  }

  interface PhrasingContentMap {
    subscript: Subscript;
    superscript: Superscript;
    highlight: Highlight;
    underline: Underline;
    wikiLink: WikiLink;
  }
}
