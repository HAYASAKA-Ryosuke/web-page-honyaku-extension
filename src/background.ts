import browser from "webextension-polyfill";

type ProviderId = "claude" | "sakura";

const DEFAULT_PROVIDER: ProviderId = "claude";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_SAKURA_MODEL = "llm-jp-3.1-8x13b-instruct4";
const SAKURA_API_ENDPOINT = "https://api.ai.sakura.ad.jp/v1/chat/completions";

function buildTranslationPrompt(texts: string[], targetLang: string): string {
  const combinedText = texts
    .map((text, index) => `${index + 1}. ${text}`)
    .join("\n");

  return targetLang === "en"
    ? `以下の日本語テキストを自然な英語に翻訳してください。

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

形式:
- 元の番号を保持して、番号付きリストで返す
- 翻訳結果のみを返す（説明不要）
- 翻訳すべきではないテキストは元のテキストをそのまま返す

テキスト:
${combinedText}
  `
    : `以下の英語テキストを自然な日本語に翻訳してください。

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

形式:
- 元の番号を保持して、番号付きリストで返す
- 翻訳結果のみを返す（説明不要）
- 翻訳すべきではないテキストは元のテキストをそのまま返す

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
    if (!translation || translation.trim().length < original.trim().length * 0.3) {
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
  const prompt = buildTranslationPrompt(texts, targetLang);

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
      messages: [
        {
          role: "user",
          content: prompt,
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
  const prompt = buildTranslationPrompt(texts, targetLang);

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
          role: "user",
          content: prompt,
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
    browser.contextMenus.create({
      id: "translateSelection",
      title: "選択テキストを日本語に翻訳",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: "translateSelectionToEnglish",
      title: "選択テキストを英語に翻訳",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: "translatePageInline",
      title: "ページ全体を翻訳",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: "translateClipboard",
      title: "クリップボードを日本語に翻訳",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: "translateClipboardToEnglish",
      title: "クリップボードを英語に翻訳",
      contexts: ["page"],
    });
    // Google Chat等の複雑なDOM用
    browser.contextMenus.create({
      id: "translateSelectionOverlay",
      title: "選択テキストを翻訳（結果表示）",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: "translateSelectionOverlayToEnglish",
      title: "選択テキストを英語に翻訳（結果表示）",
      contexts: ["selection"],
    });
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
  targetLang?: string;
  includeSelectionText?: boolean;
};

const menuActionMap: Record<string, MenuActionConfig> = {
  translateSelection: { type: "TRANSLATE_SELECTION", targetLang: "ja" },
  translateSelectionToEnglish: { type: "TRANSLATE_SELECTION_TO_ENGLISH", includeSelectionText: true },
  translatePageInline: { type: "TRANSLATE_PAGE", targetLang: "ja" },
  translateClipboard: { type: "TRANSLATE_CLIPBOARD", targetLang: "ja" },
  translateClipboardToEnglish: { type: "TRANSLATE_CLIPBOARD", targetLang: "en" },
  translateSelectionOverlay: { type: "TRANSLATE_SELECTION_OVERLAY", targetLang: "ja", includeSelectionText: true },
  translateSelectionOverlayToEnglish: { type: "TRANSLATE_SELECTION_OVERLAY", targetLang: "en", includeSelectionText: true },
};

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
