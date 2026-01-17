import { useSettingsStore, type AiCommandTrigger } from "@/stores/settingsStore";
import { SettingRow, SettingsGroup, Select } from "./components";

const TRIGGER_OPTIONS: { value: AiCommandTrigger; label: string }[] = [
  { value: ",, ", label: ",, (space)" },
  { value: ";; ", label: ";; (space)" },
  { value: "// ", label: "// (space)" },
];

export function AiSettings() {
  const ai = useSettingsStore((state) => state.ai);
  const updateSetting = useSettingsStore((state) => state.updateAiSetting);

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        AI
      </h2>
      <p className="text-xs text-[var(--text-tertiary)] mb-4">
        Configure AI command triggers.
      </p>

      <SettingsGroup title="Commands">
        <SettingRow
          label="Command trigger"
          description="Choose the prefix (with a trailing space) that opens the AI command menu"
        >
          <Select<AiCommandTrigger>
            value={ai.commandTrigger}
            options={TRIGGER_OPTIONS}
            onChange={(v) => updateSetting("commandTrigger", v)}
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
