/**
 * Provider Switcher Popover
 *
 * Inline popover for switching AI providers directly from the GeniePicker footer.
 * Shows CLI providers (with availability badges) and REST providers (with key hints).
 */

import { useEffect, useRef } from "react";
import { useAiProviderStore, REST_TYPES, KEY_OPTIONAL_REST } from "@/stores/aiProviderStore";
import { openSettingsWindow } from "@/utils/settingsWindow";
import { Check, Settings } from "lucide-react";
import type { ProviderType } from "@/types/aiGenies";

interface ProviderSwitcherProps {
  onClose(): void;
  onCloseAll(): void;
}

/** Mask an API key for display: show last 4 chars */
function maskKey(key: string): string {
  if (!key || key.length < 5) return "";
  return `\u2022\u2022\u2022\u2022${key.slice(-4)}`;
}

export function ProviderSwitcher({ onClose, onCloseAll }: ProviderSwitcherProps) {
  const cliProviders = useAiProviderStore((s) => s.cliProviders);
  const restProviders = useAiProviderStore((s) => s.restProviders);
  const activeProvider = useAiProviderStore((s) => s.activeProvider);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer to avoid catching the opening click
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Escape closes just the switcher (stop propagation to prevent closing picker)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  const handleSelect = (type: ProviderType) => {
    useAiProviderStore.getState().activateProvider(type);
    onClose();
  };

  const handleOpenSettings = () => {
    onCloseAll();
    openSettingsWindow("integrations");
  };

  return (
    <div ref={containerRef} className="provider-switcher">
      {/* CLI providers */}
      {cliProviders.length > 0 && (
        <div className="provider-switcher-section">
          <div className="provider-switcher-label">CLI</div>
          {cliProviders.map((p) => (
            <button
              key={p.type}
              type="button"
              className={`provider-switcher-item${!p.available ? " provider-switcher-item--unavailable" : ""}`}
              onClick={() => p.available && handleSelect(p.type)}
              disabled={!p.available}
            >
              <span className="provider-switcher-check">
                {activeProvider === p.type && <Check size={12} />}
              </span>
              <span className="provider-switcher-name">{p.name}</span>
              <span className={`provider-switcher-badge${p.available ? " provider-switcher-badge--available" : ""}`}>
                {p.available ? "Available" : "Not found"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* REST providers */}
      <div className="provider-switcher-section">
        <div className="provider-switcher-label">API</div>
        {restProviders.map((p) => {
          const hasKey = !!p.apiKey || KEY_OPTIONAL_REST.has(p.type);
          return (
            <button
              key={p.type}
              type="button"
              className="provider-switcher-item"
              onClick={() => handleSelect(p.type)}
            >
              <span className="provider-switcher-check">
                {activeProvider === p.type && <Check size={12} />}
              </span>
              <span className="provider-switcher-name">{p.name}</span>
              {REST_TYPES.has(p.type) && !KEY_OPTIONAL_REST.has(p.type) && (
                <span className={`provider-switcher-key${hasKey ? " provider-switcher-key--set" : ""}`}>
                  {hasKey ? maskKey(p.apiKey) : "No key"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Settings link */}
      <div className="provider-switcher-footer">
        <button
          type="button"
          className="provider-switcher-settings"
          onClick={handleOpenSettings}
        >
          <Settings size={12} />
          Settings...
        </button>
      </div>
    </div>
  );
}
