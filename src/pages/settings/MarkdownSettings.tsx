import {
  useSettingsStore,
  type MediaBorderStyle,
  type AutoPairCJKStyle,
  type HtmlRenderingMode,
  type MarkdownPasteMode,
} from "@/stores/settingsStore";
import { SettingRow, Toggle, SettingsGroup, Select } from "./components";

export function MarkdownSettings() {
  const markdown = useSettingsStore((state) => state.markdown);
  const updateSetting = useSettingsStore((state) => state.updateMarkdownSetting);

  // Normalize optional settings once to avoid inconsistent behavior
  const autoPairEnabled = markdown.autoPairEnabled ?? true;
  const autoPairCJKStyle = markdown.autoPairCJKStyle ?? "auto";

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        Markdown
      </h2>
      <p className="text-xs text-[var(--text-tertiary)] mb-4">
        Configure whitespace and line break behavior for markdown editing.
      </p>

      <SettingsGroup title="Editing">
        <SettingRow
          label="Reveal inline syntax"
          description="Show markdown markers (**, *, `) when cursor is in formatted text"
        >
          <Toggle
            checked={markdown.revealInlineSyntax}
            onChange={(v) => updateSetting("revealInlineSyntax", v)}
          />
        </SettingRow>
        <SettingRow
          label="Enable regex in search"
          description="Show regex toggle button in Find & Replace bar"
        >
          <Toggle
            checked={markdown.enableRegexSearch}
            onChange={(v) => updateSetting("enableRegexSearch", v)}
          />
        </SettingRow>

        <SettingRow
          label="Smart paste Markdown"
          description="Convert pasted Markdown text into rich content in WYSIWYG"
        >
          <Select<MarkdownPasteMode>
            value={markdown.pasteMarkdownInWysiwyg}
            options={[
              { value: "auto", label: "Auto (detect Markdown)" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => updateSetting("pasteMarkdownInWysiwyg", v)}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Auto-Pairing">
        <SettingRow
          label="Enable auto-pairing"
          description="Automatically insert closing brackets and quotes"
        >
          <Toggle
            checked={autoPairEnabled}
            onChange={(v) => updateSetting("autoPairEnabled", v)}
          />
        </SettingRow>
        <SettingRow
          label="CJK brackets"
          description="Auto-pair CJK brackets like 「」【】《》"
          disabled={!autoPairEnabled}
        >
          <Select<AutoPairCJKStyle>
            value={autoPairCJKStyle}
            options={[
              { value: "off", label: "Off" },
              { value: "auto", label: "Auto" },
            ]}
            onChange={(v) => updateSetting("autoPairCJKStyle", v)}
            disabled={!autoPairEnabled}
          />
        </SettingRow>
        {autoPairCJKStyle !== "off" && (
          <SettingRow
            label="Include curly quotes"
            description={`Auto-pair \u201C\u201D and \u2018\u2019 (may conflict with IME smart quotes)`}
            disabled={!autoPairEnabled}
          >
            <Toggle
              checked={markdown.autoPairCurlyQuotes ?? false}
              onChange={(v) => updateSetting("autoPairCurlyQuotes", v)}
              disabled={!autoPairEnabled}
            />
          </SettingRow>
        )}
      </SettingsGroup>

      <SettingsGroup title="Media Display">
        <SettingRow
          label="Image & diagram borders"
          description="Show borders around images, Mermaid diagrams, and math blocks"
        >
          <Select<MediaBorderStyle>
            value={markdown.mediaBorderStyle}
            options={[
              { value: "none", label: "None" },
              { value: "always", label: "Always" },
              { value: "hover", label: "On hover" },
            ]}
            onChange={(v) => updateSetting("mediaBorderStyle", v)}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="HTML Rendering">
        <SettingRow
          label="Raw HTML in rich text"
          description="Control whether raw HTML is hidden or rendered (sanitized)"
        >
          <Select<HtmlRenderingMode>
            value={markdown.htmlRenderingMode}
            options={[
              { value: "hidden", label: "Hidden" },
              { value: "sanitized", label: "Sanitized" },
              { value: "sanitizedWithStyles", label: "Sanitized + styles" },
            ]}
            onChange={(v) => updateSetting("htmlRenderingMode", v)}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Whitespace & Line Breaks">
        <SettingRow
          label="Preserve consecutive line breaks"
          description="Keep multiple blank lines as-is (don't collapse)"
        >
          <Toggle
            checked={markdown.preserveLineBreaks}
            onChange={(v) => updateSetting("preserveLineBreaks", v)}
          />
        </SettingRow>
        <SettingRow
          label="Hard break style on save"
          description="Preserve source style or normalize hard line breaks"
        >
          <Select
            value={markdown.hardBreakStyleOnSave}
            options={[
              { value: "preserve", label: "Preserve existing" },
              { value: "backslash", label: "Backslash (\\\\)" },
              { value: "twoSpaces", label: "Two spaces" },
            ]}
            onChange={(v) => updateSetting("hardBreakStyleOnSave", v as typeof markdown.hardBreakStyleOnSave)}
          />
        </SettingRow>
        <SettingRow
          label="Show <br> tags"
          description="Display HTML line break tags visibly in editor"
        >
          <Toggle
            checked={markdown.showBrTags}
            onChange={(v) => updateSetting("showBrTags", v)}
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
