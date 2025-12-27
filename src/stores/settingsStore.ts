import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  tabWidth: number;
}

interface AppearanceSettings {
  theme: "light" | "dark" | "system";
}

interface SettingsState {
  editor: EditorSettings;
  appearance: AppearanceSettings;
}

interface SettingsActions {
  updateEditorSetting: <K extends keyof EditorSettings>(
    key: K,
    value: EditorSettings[K]
  ) => void;
  updateAppearanceSetting: <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K]
  ) => void;
  resetSettings: () => void;
}

const initialState: SettingsState = {
  editor: {
    fontSize: 16,
    fontFamily: "system-ui",
    lineHeight: 1.6,
    tabWidth: 2,
  },
  appearance: {
    theme: "system",
  },
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...initialState,

      updateEditorSetting: (key, value) =>
        set((state) => ({
          editor: { ...state.editor, [key]: value },
        })),

      updateAppearanceSetting: (key, value) =>
        set((state) => ({
          appearance: { ...state.appearance, [key]: value },
        })),

      resetSettings: () => set(initialState),
    }),
    {
      name: "vmark-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
