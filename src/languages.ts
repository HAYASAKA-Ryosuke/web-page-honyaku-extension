export const SUPPORTED_LANGUAGES = ["ja", "en", "th", "hi"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_TARGET_LANGUAGE: SupportedLanguage = "ja";
export const DEFAULT_CONTEXT_MENU_PRIMARY_LANGUAGE: SupportedLanguage = "ja";
export const DEFAULT_CONTEXT_MENU_SECONDARY_LANGUAGE: SupportedLanguage = "en";

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
    nativeLabel: "タイ語",
  },
  hi: {
    label: "Hindi",
    nativeLabel: "ヒンディー語",
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

export function normalizeLanguagePair(
  primary: unknown,
  secondary: unknown
): { primary: SupportedLanguage; secondary: SupportedLanguage } {
  const normalizedPrimary = normalizeTargetLanguage(primary);
  const normalizedSecondary = normalizeTargetLanguage(secondary);

  if (normalizedPrimary !== normalizedSecondary) {
    return {
      primary: normalizedPrimary,
      secondary: normalizedSecondary,
    };
  }

  const fallbackSecondary = SUPPORTED_LANGUAGES.find((language) => language !== normalizedPrimary)
    ?? DEFAULT_CONTEXT_MENU_SECONDARY_LANGUAGE;

  return {
    primary: normalizedPrimary,
    secondary: fallbackSecondary,
  };
}

function countJapaneseCharacters(text: string): number {
  const matches = text.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g);
  return matches?.length ?? 0;
}

function countThaiCharacters(text: string): number {
  const matches = text.match(/[\u0e00-\u0e7f]/g);
  return matches?.length ?? 0;
}

function countHindiCharacters(text: string): number {
  const matches = text.match(/[\u0900-\u097f]/g);
  return matches?.length ?? 0;
}

function countLatinCharacters(text: string): number {
  const matches = text.match(/[A-Za-z]/g);
  return matches?.length ?? 0;
}

function countLanguageScriptCharacters(text: string, language: SupportedLanguage): number {
  if (language === "ja") {
    return countJapaneseCharacters(text);
  }
  if (language === "th") {
    return countThaiCharacters(text);
  }
  if (language === "hi") {
    return countHindiCharacters(text);
  }
  return countLatinCharacters(text);
}

export function detectLanguageFromText(
  text: string,
  primary: SupportedLanguage,
  secondary: SupportedLanguage
): SupportedLanguage | null {
  const normalized = normalizeLanguagePair(primary, secondary);
  const primaryCount = countLanguageScriptCharacters(text, normalized.primary);
  const secondaryCount = countLanguageScriptCharacters(text, normalized.secondary);

  if (primaryCount === 0 && secondaryCount === 0) {
    return null;
  }

  if (primaryCount === secondaryCount) {
    return null;
  }

  return primaryCount > secondaryCount ? normalized.primary : normalized.secondary;
}

export function resolveAutoTargetLanguage(
  text: string,
  primary: SupportedLanguage,
  secondary: SupportedLanguage
): SupportedLanguage {
  const normalized = normalizeLanguagePair(primary, secondary);
  const detectedLanguage = detectLanguageFromText(text, normalized.primary, normalized.secondary);

  if (detectedLanguage === normalized.primary) {
    return normalized.secondary;
  }

  if (detectedLanguage === normalized.secondary) {
    return normalized.primary;
  }

  return normalized.secondary;
}
