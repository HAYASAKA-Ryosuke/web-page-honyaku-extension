export const SUPPORTED_LANGUAGES = ["ja", "en", "th"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_TARGET_LANGUAGE: SupportedLanguage = "ja";

type LanguageMeta = {
  label: string;
  nativeLabel: string;
};

export const LANGUAGE_META: Record<SupportedLanguage, LanguageMeta> = {
  ja: {
    label: "Japanese",
    nativeLabel: "日本語",
  },
  en: {
    label: "English",
    nativeLabel: "英語",
  },
  th: {
    label: "Thai",
    nativeLabel: "ไทย",
  },
};

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function normalizeTargetLanguage(value: unknown): SupportedLanguage {
  return isSupportedLanguage(value) ? value : DEFAULT_TARGET_LANGUAGE;
}

export function getLanguageNativeLabel(lang: SupportedLanguage): string {
  return LANGUAGE_META[lang].nativeLabel;
}

export function getTranslationDirectionLabel(targetLang: SupportedLanguage): string {
  return `翻訳先: ${getLanguageNativeLabel(targetLang)}`;
}
