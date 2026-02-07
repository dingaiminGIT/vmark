/**
 * Dynamic Lucide icon renderer for genie metadata.
 *
 * Maps kebab-case icon names (from genie frontmatter) to Lucide React
 * components. Unknown names fall back to Sparkles.
 */

import type { LucideProps } from "lucide-react";
import {
  Check,
  Feather,
  FileText,
  Heading,
  Languages,
  ListTree,
  Palette,
  PenLine,
  RefreshCw,
  Scissors,
  Sparkles,
  UnfoldVertical,
} from "lucide-react";
import type { ComponentType } from "react";

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  check: Check,
  feather: Feather,
  "file-text": FileText,
  heading: Heading,
  languages: Languages,
  "list-tree": ListTree,
  palette: Palette,
  "pen-line": PenLine,
  "refresh-cw": RefreshCw,
  scissors: Scissors,
  sparkles: Sparkles,
  "unfold-vertical": UnfoldVertical,
};

interface GenieIconProps {
  name?: string;
  size?: number;
  className?: string;
}

export function GenieIcon({ name, size = 14, className }: GenieIconProps) {
  const Icon = (name && ICON_MAP[name]) || Sparkles;
  return <Icon size={size} className={className} />;
}
