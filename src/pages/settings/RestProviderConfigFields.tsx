/**
 * Inline config fields for a REST AI provider (endpoint, API key, model).
 *
 * Rendered when the provider is the active selection.
 */

import type { RestProviderType } from "@/types/aiGenies";
import { useAiProviderStore } from "@/stores/aiProviderStore";

const inputClass = `w-full px-2 py-1 text-xs rounded
  bg-[var(--bg-tertiary)] text-[var(--text-color)]
  border border-[var(--border-color)]
  focus:border-[var(--primary-color)] outline-none
  font-mono`;

interface RestProviderConfigFieldsProps {
  type: RestProviderType;
  endpoint: string;
  apiKey: string;
  model: string;
}

export function RestProviderConfigFields({
  type,
  endpoint,
  apiKey,
  model,
}: RestProviderConfigFieldsProps) {
  const handleChange = (field: "endpoint" | "apiKey" | "model", value: string) => {
    useAiProviderStore.getState().updateRestProvider(type, { [field]: value });
  };

  return (
    <div className="flex flex-col gap-1.5 ml-5.5 mt-1">
      {type !== "google-ai" && (
        <input
          className={inputClass}
          placeholder="API Endpoint"
          value={endpoint}
          onChange={(e) => handleChange("endpoint", e.target.value)}
        />
      )}
      <input
        className={inputClass}
        placeholder="API Key"
        type="password"
        value={apiKey}
        onChange={(e) => handleChange("apiKey", e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Model"
        value={model}
        onChange={(e) => handleChange("model", e.target.value)}
      />
    </div>
  );
}
