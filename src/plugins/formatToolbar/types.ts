export type ContextMode = "format" | "inline-insert" | "block-insert";

export interface HeadingInfo {
  level: number; // 1-6, or 0 for paragraph
  nodePos: number;
}

export interface CodeBlockInfo {
  language: string;
  nodePos: number;
}

export interface TableNodeContext {
  type: "table";
  tablePos: number;
  rowIndex: number;
  colIndex: number;
  numRows: number;
  numCols: number;
}

export interface ListNodeContext {
  type: "list";
  listType: "bullet" | "ordered" | "task";
  nodePos: number;
  depth: number;
}

export interface BlockquoteNodeContext {
  type: "blockquote";
  nodePos: number;
  depth: number;
}

export type NodeContext =
  | TableNodeContext
  | ListNodeContext
  | BlockquoteNodeContext
  | null;
