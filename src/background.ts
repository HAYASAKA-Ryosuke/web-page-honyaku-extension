import browser from "webextension-polyfill";
import {
  getLanguageNativeLabel,
  normalizeTargetLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "./languages";

type ProviderId = "claude" | "sakura";

const DEFAULT_PROVIDER: ProviderId = "claude";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_SAKURA_MODEL = "llm-jp-3.1-8x13b-instruct4";
const SAKURA_API_ENDPOINT = "https://api.ai.sakura.ad.jp/v1/chat/completions";
const MIN_TRANSLATION_LENGTH_RATIO = 0.3;

export function buildTranslationSystemPrompt(targetLang: string): string {
  const normalizedLang = normalizeTargetLanguage(targetLang);
  if (normalizedLang === "en") {
    return `あなたは高精度の翻訳エンジンです。入力テキストを自然な英語に翻訳してください。

条件:
- 直訳ではなく、自然な英語として意味の流れを再構成すること
- 文脈に応じて適切なトーン（フォーマル/カジュアル）を選択する
- チャットやメッセージの場合は、簡潔で自然な表現を優先する
- 専門用語は正確に訳す
- 冗長な表現を避け、明確で分かりやすい英語にする
- 日本語特有の曖昧な表現は、文脈から意図を汲み取って明確に訳す

重要:
- フィンガープリント、ハッシュ値、UUID、ID、コード、URL、メールアドレス、数値のみのテキストなど、翻訳すべきではないテキストの場合は、元のテキストをそのまま返してください
- 翻訳すべきかどうか判断に迷う場合は、元のテキストをそのまま返してください

出力形式:
- 元の番号を保持して、番号付きリストで返す
- 翻訳結果のみを返す
- 説明、補足、前置き、コードブロックを付けない
- 翻訳すべきではないテキストは元のテキストをそのまま返す`;
  }

  if (normalizedLang === "th") {
    return `あなたは高精度の翻訳エンジンです。入力テキストを自然なタイ語に翻訳してください。

条件:
- 直訳ではなく、自然なタイ語として意味の流れを再構成すること
- チャットやメッセージでは、読みやすく自然な口調を優先する
- 丁寧さは文脈に合わせて調整し、不自然に堅くしすぎない
- 専門用語、製品名、固有名詞は正確に扱い、必要なら原語を残す
- 冗長な表現を避け、タイ語として滑らかに読める文にする

重要:
- フィンガープリント、ハッシュ値、UUID、ID、コード、URL、メールアドレス、数値のみのテキストなど、翻訳すべきではないテキストの場合は、元のテキストをそのまま返してください
- 翻訳すべきかどうか判断に迷う場合は、元のテキストをそのまま返してください

出力形式:
- 元の番号を保持して、番号付きリストで返す
- 翻訳結果のみを返す
- 説明、補足、前置き、コードブロックを付けない
- 翻訳すべきではないテキストは元のテキストをそのまま返す`;
  }

  if (normalizedLang === "hi") {
    return `あなたは高精度の翻訳エンジンです。入力テキストを自然なヒンディー語に翻訳してください。

条件:
- 直訳ではなく、自然なヒンディー語として意味の流れを再構成すること
- チャットやメッセージでは、簡潔で自然な口調を優先する
- 敬意表現や丁寧さは文脈に合わせて調整し、不自然に堅くしすぎない
- 専門用語、製品名、固有名詞は正確に扱い、必要なら原語を残す
- 冗長な表現を避け、ヒンディー語として読みやすく滑らかな文にする

重要:
- フィンガープリント、ハッシュ値、UUID、ID、コード、URL、メールアドレス、数値のみのテキストなど、翻訳すべきではないテキストの場合は、元のテキストをそのまま返してください
- 翻訳すべきかどうか判断に迷う場合は、元のテキストをそのまま返してください

出力形式:
- 元の番号を保持して、番号付きリストで返す
- 翻訳結果のみを返す
- 説明、補足、前置き、コードブロックを付けない
- 翻訳すべきではないテキストは元のテキストをそのまま返す`;
  }

  return `あなたは高精度の翻訳エンジンです。入力テキストを自然な日本語に翻訳してください。

条件:
- 直訳ではなく、自然な日本語として意味の流れを再構成すること
- 技術エッセイ風の語り口で、論理的だが人間味のあるトーンにする
- 文体は「だ・である調」を用いる
- 専門用語は正確に訳し、必要なら英語を併記（例: 和型 (sum type)）
- カタカナ語を乱用しない
- 冗長な構文を避け、文の主語と述語の対応を明確にする
- 段落ごとに一つの中心的な主張・感情が伝わるようにする
- 英語的な語順を避け、日本人が自然に読める順序に並べ替える

重要:
- フィンガープリント、ハッシュ値、UUID、ID、コード、URL、メールアドレス、数値のみのテキストなど、翻訳すべきではないテキストの場合は、元のテキストをそのまま返してください
- 翻訳すべきかどうか判断に迷う場合は、元のテキストをそのまま返してください

出力形式:
- 元の番号を保持して、番号付きリストで返す
- 翻訳結果のみを返す
- 説明、補足、前置き、コードブロックを付けない
- 翻訳すべきではないテキストは元のテキストをそのまま返す`;
}

export function buildTranslationUserPrompt(texts: string[], targetLang: string): string {
  const combinedText = texts
    .map((text, index) => `${index + 1}. ${text}`)
    .join("\n");
  const normalizedLang = normalizeTargetLanguage(targetLang);
  const targetLabel = getLanguageNativeLabel(normalizedLang);

  return `以下のテキストを自然な${targetLabel}に翻訳してください。
番号は入力との対応付けのため必ず保持してください。

テキスト:
${combinedText}
  `;
}

function extractTranslations(texts: string[], translatedText: string): string[] {
  const lines = translatedText
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);

  const translations = lines.map((line: string, index: number) => {
    const translation = line.replace(/^\d+[\.\)]\s*/, "").trim();

    if (!translation || translation.length === 0) {
      return texts[index] || "";
    }

    return translation;
  });

  if (translations.length !== texts.length) {
    console.warn(
      `翻訳結果の数が一致しません。期待: ${texts.length}, 実際: ${translations.length}`
    );
    if (translations.length === 1) {
      return texts.map((original, index) => {
        if (index === 0 && translations[0]) {
          return translations[0];
        }
        return original;
      });
    }
    while (translations.length < texts.length) {
      const originalIndex = translations.length;
      translations.push(texts[originalIndex] || "");
    }
    return translations.slice(0, texts.length);
  }

  return translations.map((translation: string, index: number) => {
    const original = texts[index];
    if (translation === original) {
      return original;
    }
    if (!translation || translation.trim().length < original.trim().length * MIN_TRANSLATION_LENGTH_RATIO) {
      return original;
    }
    return translation;
  });
}

function normalizeProvider(value: unknown): ProviderId {
  return value === "sakura" ? "sakura" : DEFAULT_PROVIDER;
}

async function getTranslationSettings(): Promise<{
  provider: ProviderId;
  apiKey?: string;
  model: string;
}> {
  const result = await browser.storage.local.get([
    "provider",
    "claudeApiKey",
    "claudeModel",
    "sakuraApiKey",
    "sakuraModel",
  ]);
  const provider = normalizeProvider(result.provider);
  const apiKey = provider === "sakura"
    ? (result.sakuraApiKey as string | undefined)
    : (result.claudeApiKey as string | undefined);
  const fallbackApiKey = result.claudeApiKey as string | undefined;
  const model = provider === "sakura"
    ? (result.sakuraModel as string | undefined) || DEFAULT_SAKURA_MODEL
    : (result.claudeModel as string | undefined) || DEFAULT_CLAUDE_MODEL;

  return { provider, apiKey: apiKey || (provider === "claude" ? fallbackApiKey : undefined), model };
}

// Claude APIを呼び出す関数
async function callClaudeAPI(
  texts: string[],
  targetLang: string,
  apiKey: string,
  model: string
): Promise<string[]> {
  const systemPrompt = buildTranslationSystemPrompt(targetLang);
  const userPrompt = buildTranslationUserPrompt(texts, targetLang);

  console.log("[BG] Claude APIにリクエストを送信:", {
    model,
    textCount: texts.length,
    targetLang,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model || DEFAULT_CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Claude APIエラー: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const translatedText = data.content?.[0]?.text || "";

  if (!translatedText) {
    throw new Error("翻訳結果が空です");
  }

  return extractTranslations(texts, translatedText);
}

async function callSakuraAPI(
  texts: string[],
  targetLang: string,
  apiKey: string,
  model: string
): Promise<string[]> {
  const systemPrompt = buildTranslationSystemPrompt(targetLang);
  const userPrompt = buildTranslationUserPrompt(texts, targetLang);

  console.log("[BG] Sakura AI APIにリクエストを送信:", {
    model,
    textCount: texts.length,
    targetLang,
  });

  const response = await fetch(SAKURA_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_SAKURA_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Sakura APIエラー: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const translatedText = data.choices?.[0]?.message?.content || "";

  if (!translatedText) {
    throw new Error("翻訳結果が空です");
  }

  return extractTranslations(texts, translatedText);
}

// ポップアップ → バックグラウンド間メッセージ
browser.runtime.onMessage.addListener((msg: any, _sender: browser.Runtime.MessageSender, sendResponse: (response: any) => void) => {
  if (msg.type === "PING") {
    (sendResponse as (response: any) => void)({ ok: true, now: new Date().toISOString() });
    return false;
  }

  // 翻訳リクエスト（コンテンツスクリプトから）
  if (msg.type === "TRANSLATE_TEXTS") {
    (async () => {
      try {
        console.log("[BG] 翻訳リクエストを受信:", {
          textCount: (msg.texts as string[])?.length,
          targetLang: msg.targetLang,
        });

        const { provider, apiKey, model } = await getTranslationSettings();

        if (!apiKey) {
          throw new Error(
            provider === "sakura"
              ? "Sakura AI APIキーが設定されていません"
              : "Claude APIキーが設定されていません"
          );
        }

        console.log(`[BG] ${provider} APIを呼び出します...`);
        const translations = provider === "sakura"
          ? await callSakuraAPI(
              msg.texts as string[],
              msg.targetLang as string,
              apiKey,
              model
            )
          : await callClaudeAPI(
              msg.texts as string[],
              msg.targetLang as string,
              apiKey,
              model
            );

        console.log("[BG] 翻訳成功:", { translationCount: translations.length });
        (sendResponse as (response: any) => void)({ success: true, translations });
      } catch (error) {
        console.error("[BG] 翻訳エラー:", error);
        (sendResponse as (response: any) => void)({
          success: false,
          error: error instanceof Error ? error.message : "不明なエラー",
        });
      }
    })();
    return true; // 非同期レスポンスを許可
  }

  // クリップボード翻訳結果を保存（コンテンツスクリプトから。ポップアップで表示するため）
  if (msg.type === "STORE_CLIPBOARD_TRANSLATION") {
    browser.storage.local
      .set({ lastClipboardTranslation: { translation: msg.translation as string } })
      .then(() => (sendResponse as (response: any) => void)({ success: true }))
      .catch((err) => (sendResponse as (response: any) => void)({ success: false, error: String(err) }));
    return true;
  }

  return false;
});

/** 右クリックメニューを登録（起動時・インストール時の両方で実行） */
function createContextMenus(): void {
  browser.contextMenus.removeAll().then(() => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const langLabel = getLanguageNativeLabel(lang);
      browser.contextMenus.create({
        id: `translatePageInline:${lang}`,
        title: `ページ全体を${langLabel}に翻訳`,
        contexts: ["page"],
      });
      browser.contextMenus.create({
        id: `translateSelection:${lang}`,
        title: `選択テキストを${langLabel}に翻訳`,
        contexts: ["selection"],
      });
      browser.contextMenus.create({
        id: `translateSelectionToClipboard:${lang}`,
        title: `選択テキストを${langLabel}に翻訳してコピー`,
        contexts: ["selection"],
      });
      browser.contextMenus.create({
        id: `translateClipboard:${lang}`,
        title: `クリップボードを${langLabel}に翻訳`,
        contexts: ["page"],
      });
      browser.contextMenus.create({
        id: `translateSelectionOverlay:${lang}`,
        title: `選択テキストを${langLabel}に翻訳（結果表示）`,
        contexts: ["selection"],
      });
    }
  });
}

// 拡張の起動時にもメニューを登録（リロード後すぐに表示されるようにする）
createContextMenus();

browser.runtime.onInstalled.addListener(() => {
  console.log("[bg] installed");
  createContextMenus();
});

/** コンテキストメニューアクションを実行するヘルパー関数 */
async function handleMenuAction(
  tabId: number,
  message: { type: string; targetLang?: string; selectionText?: string }
): Promise<void> {
  try {
    await browser.action.setBadgeText({ tabId, text: "..." });
    const response = await browser.tabs.sendMessage(tabId, message) as { success?: boolean } | undefined;
    const badgeText = response?.success ? "✓" : "✗";
    await browser.action.setBadgeText({ tabId, text: badgeText });
    setTimeout(() => browser.action.setBadgeText({ tabId, text: "" }), 2000);
  } catch (error) {
    console.error("翻訳エラー:", error);
    await browser.action.setBadgeText({ tabId, text: "✗" });
    setTimeout(() => browser.action.setBadgeText({ tabId, text: "" }), 2000);
  }
}

/** メニューIDとメッセージのマッピング */
type MenuActionConfig = {
  type: string;
  targetLang?: SupportedLanguage;
  includeSelectionText?: boolean;
};

const menuActionMap: Record<string, MenuActionConfig> = {};

for (const lang of SUPPORTED_LANGUAGES) {
  menuActionMap[`translatePageInline:${lang}`] = {
    type: "TRANSLATE_PAGE",
    targetLang: lang,
  };
  menuActionMap[`translateSelection:${lang}`] = {
    type: "TRANSLATE_SELECTION",
    targetLang: lang,
  };
  menuActionMap[`translateSelectionToClipboard:${lang}`] = {
    type: "TRANSLATE_SELECTION_TO_CLIPBOARD",
    targetLang: lang,
    includeSelectionText: true,
  };
  menuActionMap[`translateClipboard:${lang}`] = {
    type: "TRANSLATE_CLIPBOARD",
    targetLang: lang,
  };
  menuActionMap[`translateSelectionOverlay:${lang}`] = {
    type: "TRANSLATE_SELECTION_OVERLAY",
    targetLang: lang,
    includeSelectionText: true,
  };
}

browser.contextMenus.onClicked.addListener(async (info: browser.Menus.OnClickData, tab?: browser.Tabs.Tab) => {
  if (!tab?.id) return;

  const menuId = String(info.menuItemId);
  const config = menuActionMap[menuId];
  
  if (config) {
    const message: { type: string; targetLang?: string; selectionText?: string } = {
      type: config.type,
    };
    if (config.targetLang) {
      message.targetLang = config.targetLang;
    }
    if (config.includeSelectionText) {
      message.selectionText = info.selectionText;
    }
    await handleMenuAction(tab.id, message);
  }
});
