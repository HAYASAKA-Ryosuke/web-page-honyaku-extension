import { describe, expect, it } from "vitest";
import {
  detectLanguageFromText,
  normalizeLanguagePair,
  resolveAutoTargetLanguage,
} from "../src/languages";

describe("language helpers", () => {
  it("normalizes duplicate language pair selections", () => {
    expect(normalizeLanguagePair("ja", "ja")).toEqual({
      primary: "ja",
      secondary: "en",
    });
  });

  it("detects Japanese text against a Thai/Japanese pair", () => {
    expect(detectLanguageFromText("これは日本語のメッセージです", "th", "ja")).toBe("ja");
  });

  it("detects Thai text against a Thai/Japanese pair", () => {
    expect(detectLanguageFromText("นี่คือข้อความภาษาไทย", "th", "ja")).toBe("th");
  });

  it("resolves auto target to the opposite configured language", () => {
    expect(resolveAutoTargetLanguage("これは日本語です", "th", "ja")).toBe("th");
    expect(resolveAutoTargetLanguage("นี่คือภาษาไทย", "th", "ja")).toBe("ja");
  });

  it("falls back to the secondary language when detection is unclear", () => {
    expect(resolveAutoTargetLanguage("12345 hello@example.com", "ja", "th")).toBe("th");
  });

  it("treats Japanese prose with a few English terms as Japanese", () => {
    const text = "明日のmeetingでdesign reviewを実施します";
    expect(detectLanguageFromText(text, "ja", "en")).toBe("ja");
    expect(resolveAutoTargetLanguage(text, "ja", "en")).toBe("en");
  });

  it("does not count code blocks and URLs as English prose", () => {
    expect(detectLanguageFromText("これは `getUserName()` の確認です", "ja", "en")).toBe("ja");
    expect(detectLanguageFromText("https://example.com/foo", "ja", "en")).toBeNull();
  });
});
