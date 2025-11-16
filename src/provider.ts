// ====== 翻訳プロバイダー ======
import browser from "webextension-polyfill";
import type { TranslationProvider } from "./types";

/**
 * LibreTranslate プロバイダー
 */
export function createLibreTranslateProvider(config: {
  endpoint: string;
  apiKey?: string | null;
  source?: string;
}): TranslationProvider {
  return {
    async translate(texts: string[], target: string): Promise<string[]> {
      const body = {
        q: texts,
        source: config.source || "auto",
        target,
        format: "text",
        api_key: config.apiKey || undefined,
      };

      const response = await fetch(`${config.endpoint.replace(/\/$/, "")}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`翻訳APIエラー: ${response.status}`);
      }

      const data = await response.json();

      // レスポンス形式に応じて処理
      if (Array.isArray(data)) {
        return data.map((item: any) => item.translatedText || "");
      }
      if (data.translatedText && texts.length === 1) {
        return [data.translatedText];
      }
      return texts.map((_, i) => data[i]?.translatedText ?? "");
    },
  };
}

/**
 * Claude (Anthropic) プロバイダー
 * バックグラウンドスクリプト経由でAPIを呼び出す
 */
export function createClaudeProvider(): TranslationProvider {
  return {
    async translate(texts: string[], targetLang: string): Promise<string[]> {
      console.log("[Translator] バックグラウンドスクリプトに翻訳リクエストを送信:", {
        textCount: texts.length,
        targetLang,
      });

      return new Promise((resolve, reject) => {
        const message = {
          type: "TRANSLATE_TEXTS",
          texts,
          targetLang,
        };

        browser.runtime.sendMessage(message)
          .then((response: { success?: boolean; translations?: string[]; error?: string } | undefined) => {
            if (response?.success && response.translations) {
              console.log("[Translator] 翻訳成功:", {
                translationCount: response.translations.length,
              });
              resolve(response.translations);
            } else {
              console.error("[Translator] 翻訳失敗:", response?.error);
              reject(new Error(response?.error || "翻訳に失敗しました"));
            }
          })
          .catch((error: Error) => {
            console.error("[Translator] メッセージ送信エラー:", error);
            reject(error);
          });
      });
    },
  };
}

/**
 * ダミープロバイダー（開発・テスト用）
 */
export function createDummyProvider(): TranslationProvider {
  return {
    async translate(texts: string[], target: string): Promise<string[]> {
      // デモ用: テキストの前に言語タグを付ける
      return texts.map((text) => `[${target}] ${text}`);
    },
  };
}

