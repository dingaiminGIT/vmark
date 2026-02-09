/**
 * Inline config fields for a REST AI provider (endpoint, API key, model).
 *
 * Rendered when the provider is the active selection.
 */

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import type { RestProviderType } from "@/types/aiGenies";
import { useAiProviderStore } from "@/stores/aiProviderStore";

const inputClass = `w-full px-2 py-1 text-xs rounded
  bg-[var(--bg-tertiary)] text-[var(--text-color)]
  border border-[var(--border-color)]
  focus:border-[var(--primary-color)] outline-none
  font-mono`;

const iconBtnClass = `shrink-0 p-1 rounded
  text-[var(--text-secondary)] hover:text-[var(--text-color)]
  hover:bg-[var(--hover-bg)] cursor-pointer
  focus-visible:outline-none`;

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
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleChange = (field: "endpoint" | "apiKey" | "model", value: string) => {
    useAiProviderStore.getState().updateRestProvider(type, { [field]: value });
  };

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      <div className="flex items-center gap-1">
        <input
          className={inputClass}
          placeholder="API Key"
          type={revealed ? "text" : "password"}
          value={apiKey}
          onChange={(e) => handleChange("apiKey", e.target.value)}
        />
        <button
          className={iconBtnClass}
          onClick={() => setRevealed((r) => !r)}
          title={revealed ? "Hide API key" : "Show API key"}
          tabIndex={-1}
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button
          className={iconBtnClass}
          onClick={handleCopy}
          title="Copy API key"
          tabIndex={-1}
          disabled={!apiKey}
        >
          {copied ? <Check size={14} className="text-[var(--success-color)]" /> : <Copy size={14} />}
        </button>
      </div>
      <input
        className={inputClass}
        placeholder="Model"
        value={model}
        onChange={(e) => handleChange("model", e.target.value)}
      />
    </div>
  );
}
