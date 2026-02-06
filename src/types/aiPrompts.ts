/**
 * AI Prompts Types
 *
 * Core types for the AI prompts system — prompt definitions,
 * provider configuration, and streaming response chunks.
 */

// ============================================================================
// Prompt Types
// ============================================================================

export type PromptScope = "selection" | "block" | "document";

export interface PromptMetadata {
  name: string;
  description: string;
  scope: PromptScope;
  category?: string;
  icon?: string;
  model?: string;
}

export interface PromptDefinition {
  metadata: PromptMetadata;
  template: string;
  filePath: string;
  source: "global" | "workspace";
}

// ============================================================================
// Provider Types
// ============================================================================

export type CliProviderType = "claude" | "codex" | "gemini" | "ollama";
export type RestProviderType = "anthropic" | "openai" | "google-ai" | "ollama-api";
export type ProviderType = CliProviderType | RestProviderType;

export interface CliProviderInfo {
  type: CliProviderType;
  name: string;
  command: string;
  available: boolean;
  path?: string;
}

export interface RestProviderConfig {
  type: RestProviderType;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

// ============================================================================
// Streaming Response
// ============================================================================

export interface AiResponseChunk {
  chunk: string;
  done: boolean;
  error?: string;
}
