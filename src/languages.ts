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

function countJapaneseKana(text: string): number {
  const matches = text.match(/[\u3040-\u30ff]/g);
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

function countLatinWords(text: string): number {
  const matches = text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g);
  return matches?.length ?? 0;
}

function removeNonProseSegments(text: string): string {
  return text
    // コードブロック、インラインコード、URL、メールアドレスは言語判定から除外する
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, " ");
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

function countLanguageEvidence(text: string, language: SupportedLanguage): number {
  if (language === "en") {
    // 英単語を文字数で数えると、混在した日本語文の用語に引っ張られるため、
    // 単語単位で数える。
    return countLatinWords(text);
  }

  return countLanguageScriptCharacters(text, language);
}

export function detectLanguageFromText(
  text: string,
  primary: SupportedLanguage,
  secondary: SupportedLanguage
): SupportedLanguage | null {
  const normalized = normalizeLanguagePair(primary, secondary);
  const prose = removeNonProseSegments(text);
  const primaryCount = countLanguageEvidence(prose, normalized.primary);
  const secondaryCount = countLanguageEvidence(prose, normalized.secondary);

  // 日本語は、英単語が数個混ざっただけで英語扱いにならないように、
  // ひらがな・カタカナを文構造の強い手掛かりとして加点する。
  const primaryScore = normalized.primary === "ja"
    ? primaryCount + countJapaneseKana(prose)
    : primaryCount;
  const secondaryScore = normalized.secondary === "ja"
    ? secondaryCount + countJapaneseKana(prose)
    : secondaryCount;

  if (primaryScore === 0 && secondaryScore === 0) {
    return null;
  }

  if (primaryScore === secondaryScore) {
    return null;
  }

  return primaryScore > secondaryScore ? normalized.primary : normalized.secondary;
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
