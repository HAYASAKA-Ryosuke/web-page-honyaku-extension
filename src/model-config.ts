export type ConfiguredModel = {
  value: string;
  label: string;
};

// The model can be changed at build time without touching the translation code.
// Keep the documented Anthropic model as the safe default for local builds.
const configuredClaudeModel = import.meta.env.VITE_CLAUDE_MODEL?.trim();
const DEFAULT_CLAUDE_MODEL_ID = "claude-haiku-4-5-20251001";

export const DEFAULT_SAKURA_MODEL = "llm-jp-3.1-8x13b-instruct4";

export const CLAUDE_MODELS: ConfiguredModel[] = [
  {
    value: configuredClaudeModel || DEFAULT_CLAUDE_MODEL_ID,
    label: "Claude Haiku",
  },
];

export const SAKURA_MODELS: ConfiguredModel[] = [
  {
    value: DEFAULT_SAKURA_MODEL,
    label: "llm-jp-3.1-8x13b-instruct4",
  },
];

export const DEFAULT_CLAUDE_MODEL = CLAUDE_MODELS[0].value;

export function resolveClaudeModel(value: unknown): string {
  return typeof value === "string" && CLAUDE_MODELS.some((model) => model.value === value)
    ? value
    : DEFAULT_CLAUDE_MODEL;
}
