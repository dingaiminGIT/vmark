import { useEffect } from "react";
import { useSettingsStore, themes } from "@/stores/settingsStore";

const fontStacks = {
  latin: {
    system: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    athelas: "Athelas, Georgia, serif", // Apple Books default
    palatino: "Palatino, 'Palatino Linotype', serif",
    georgia: "Georgia, 'Times New Roman', serif",
    charter: "Charter, Georgia, serif",
    literata: "Literata, Georgia, serif", // Google reading font
  },
  cjk: {
    system: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    pingfang: '"PingFang SC", "PingFang TC", sans-serif', // Apple Books
    songti: '"Songti SC", "STSong", "SimSun", serif',
    kaiti: '"Kaiti SC", "STKaiti", "KaiTi", serif',
    notoserif: '"Noto Serif CJK SC", "Source Han Serif SC", serif',
    sourcehans: '"Source Han Sans SC", "Noto Sans CJK SC", sans-serif',
  },
  mono: {
    system: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
    firacode: '"Fira Code", ui-monospace, monospace',
    jetbrains: '"JetBrains Mono", ui-monospace, monospace',
    sourcecodepro: '"Source Code Pro", ui-monospace, monospace',
    consolas: 'Consolas, "Courier New", monospace',
    inconsolata: 'Inconsolata, ui-monospace, monospace',
  },
};

export function useTheme() {
  const appearance = useSettingsStore((state) => state.appearance);

  useEffect(() => {
    const root = document.documentElement;
    const themeColors = themes[appearance.theme];

    // Apply theme colors
    root.style.setProperty("--bg-color", themeColors.background);
    root.style.setProperty("--text-color", themeColors.foreground);
    root.style.setProperty("--primary-color", themeColors.link);
    root.style.setProperty("--bg-secondary", themeColors.secondary);
    root.style.setProperty("--border-color", themeColors.border);

    // UI chrome colors (sidebar, etc.)
    root.style.setProperty("--sidebar-bg", themeColors.secondary);
    root.style.setProperty("--code-bg-color", themeColors.secondary);
    root.style.setProperty("--table-border-color", themeColors.border);

    // Apply typography
    const latinStack =
      fontStacks.latin[appearance.latinFont as keyof typeof fontStacks.latin] ||
      fontStacks.latin.system;
    const cjkStack =
      fontStacks.cjk[appearance.cjkFont as keyof typeof fontStacks.cjk] ||
      fontStacks.cjk.system;
    const monoStack =
      fontStacks.mono[appearance.monoFont as keyof typeof fontStacks.mono] ||
      fontStacks.mono.system;

    root.style.setProperty("--font-sans", `${latinStack}, ${cjkStack}`);
    root.style.setProperty("--font-mono", monoStack);
    root.style.setProperty("--editor-font-size", `${appearance.fontSize}px`);
    root.style.setProperty(
      "--editor-line-height",
      String(appearance.lineHeight)
    );
    root.style.setProperty(
      "--editor-paragraph-spacing",
      `${appearance.paragraphSpacing}em`
    );

  }, [appearance]);
}
