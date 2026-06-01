import { describe, expect, it } from "vitest";
import {
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
} from "../src/background";

describe("background translation prompts", () => {
  it("builds a strict system prompt for Sakura/Claude Japanese translation", () => {
    const prompt = buildTranslationSystemPrompt("ja");

    expect(prompt).toContain("あなたは高精度の翻訳エンジンです");
    expect(prompt).toContain("文体は「だ・である調」を用いる");
    expect(prompt).toContain("説明、補足、前置き、コードブロックを付けない");
  });

  it("builds a strict system prompt for Sakura/Claude English translation", () => {
    const prompt = buildTranslationSystemPrompt("en");

    expect(prompt).toContain("自然な英語に翻訳");
    expect(prompt).toContain("チャットやメッセージの場合は、簡潔で自然な表現を優先する");
    expect(prompt).toContain("番号付きリストで返す");
  });

  it("builds a strict system prompt for Sakura/Claude Thai translation", () => {
    const prompt = buildTranslationSystemPrompt("th");

    expect(prompt).toContain("自然なタイ語に翻訳");
    expect(prompt).toContain("読みやすく自然な口調を優先する");
    expect(prompt).toContain("番号付きリストで返す");
  });

  it("builds a strict system prompt for Sakura/Claude Hindi translation", () => {
    const prompt = buildTranslationSystemPrompt("hi");

    expect(prompt).toContain("自然なヒンディー語に翻訳");
    expect(prompt).toContain("簡潔で自然な口調を優先する");
    expect(prompt).toContain("番号付きリストで返す");
  });

  it("keeps the user prompt focused on the numbered source texts", () => {
    const prompt = buildTranslationUserPrompt(["alpha", "beta"], "th");

    expect(prompt).toContain("自然なไทยに翻訳");
    expect(prompt).toContain("番号は入力との対応付けのため必ず保持してください");
    expect(prompt).toContain("1. alpha");
    expect(prompt).toContain("2. beta");
  });

  it("uses Hindi label in the user prompt", () => {
    const prompt = buildTranslationUserPrompt(["alpha"], "hi");

    expect(prompt).toContain("自然なहिन्दीに翻訳");
    expect(prompt).toContain("1. alpha");
  });
});
