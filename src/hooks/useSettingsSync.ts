import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

const STORAGE_KEY = "vmark-settings";

/**
 * Syncs settings across windows using storage events.
 * When one window updates localStorage, other windows receive the event.
 */
export function useSettingsSync() {
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed.state?.appearance) {
            // Update the store with the new state from another window
            const currentState = useSettingsStore.getState();
            const newAppearance = parsed.state.appearance;

            // Only update if different to avoid loops
            if (
              JSON.stringify(currentState.appearance) !==
              JSON.stringify(newAppearance)
            ) {
              useSettingsStore.setState({ appearance: newAppearance });
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
}
