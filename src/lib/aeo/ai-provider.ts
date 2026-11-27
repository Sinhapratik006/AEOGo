import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/*
 * Which AI vendor powers fixes and visibility checks.
 * - AI_PROVIDER=anthropic|openai forces one (its key must be set).
 * - Otherwise Anthropic is used when ANTHROPIC_API_KEY is set, then OpenAI when OPENAI_API_KEY is set.
 */
export type AiProvider = "anthropic" | "openai";

export function aiProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  if (forced === "anthropic") return hasAnthropic ? "anthropic" : null;
  if (forced === "openai") return hasOpenAi ? "openai" : null;
  if (hasAnthropic) return "anthropic";
  if (hasOpenAi) return "openai";
  return null;
}

export function aiEnabled(): boolean {
  return aiProvider() !== null;
}

export function aiModel(): string {
  if (aiProvider() === "openai") return process.env.OPENAI_MODEL || "gpt-5.5";
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

/**
 * OpenAI only accepts `reasoning.effort` on reasoning models (o-series, gpt-5+).
 * Older chat models such as gpt-4o / gpt-4.1 reject it with a 400.
 */
export function openAiSupportsReasoning(model: string): boolean {
  const m = model.toLowerCase();
  return /^o\d/.test(m) || /^gpt-([5-9]|\d{2,})/.test(m);
}

/** Human-readable name and key variable of the active provider, for error messages. */
export function aiProviderLabel(): { name: string; keyVar: string } {
  return aiProvider() === "openai"
    ? { name: "OpenAI", keyVar: "OPENAI_API_KEY" }
    : { name: "Anthropic", keyVar: "ANTHROPIC_API_KEY" };
}

export const AI_KEY_HINT = "Set ANTHROPIC_API_KEY or OPENAI_API_KEY";

export class AiAuthError extends Error {}

/** Converts vendor auth/permission errors into AiAuthError; rethrows everything else. */
export function rethrowAiError(err: unknown): never {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    err instanceof OpenAI.AuthenticationError ||
    err instanceof OpenAI.PermissionDeniedError
  ) {
    throw new AiAuthError(err.message);
  }
  throw err;
}

const anthropicClients = new Map<string, Anthropic>();
export function anthropicClient(opts: { maxRetries: number; timeout: number }): Anthropic {
  const key = `${opts.maxRetries}:${opts.timeout}`;
  let c = anthropicClients.get(key);
  if (!c) {
    c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...opts });
    anthropicClients.set(key, c);
  }
  return c;
}

const openAiClients = new Map<string, OpenAI>();
export function openAiClient(opts: { maxRetries: number; timeout: number }): OpenAI {
  const key = `${opts.maxRetries}:${opts.timeout}`;
  let c = openAiClients.get(key);
  if (!c) {
    c = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...opts });
    openAiClients.set(key, c);
  }
  return c;
}
