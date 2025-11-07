chrome.runtime.onInstalled.addListener(() => {
  console.log("[bg] installed");
});

// Claude APIを呼び出す関数
async function callClaudeAPI(
  texts: string[],
  targetLang: string,
  apiKey: string,
  model: string
): Promise<string[]> {
  // 言語コードを日本語名に変換
  const langMap: Record<string, string> = {
    ja: "日本語",
    en: "英語",
    zh: "中国語",
    ko: "韓国語",
    es: "スペイン語",
    fr: "フランス語",
    de: "ドイツ語",
    pt: "ポルトガル語",
    ru: "ロシア語",
    it: "イタリア語",
  };
  const targetLangName = langMap[targetLang] || targetLang;

  // テキストを結合して1つのプロンプトにする
  const combinedText = texts
    .map((text, index) => `${index + 1}. ${text}`)
    .join("\n");

//  const prompt = `以下のテキストを${targetLangName}に翻訳してください。各項目を番号付きリストの形式で返してください。元の番号を保持してください。
//
//${combinedText}
//
//翻訳結果のみを返してください。説明や追加のテキストは不要です。`;
  const prompt = `以下の英語テキストを自然な日本語に翻訳してください。

条件:
- 直訳ではなく、自然な日本語として意味の流れを再構成してよい
- 英語の文構造に引きずられず、日本語のリズムと焦点を優先する
- 技術エッセイ風の語り口で、論理的だが人間味のあるトーンにする
- 文体は「だ・である調」を用いる（文末は〜だ／〜である／〜なのだ等を使い分ける）
- 専門用語は正確に訳し、必要なら英語を併記（例: 和型 (sum type)）
- カタカナ語を乱用しない
- 冗長な構文を避け、文の主語と述語の対応を明確にする
- 段落ごとに一つの中心的な主張・感情が伝わるようにする
- 英語的な語順を避け、日本人が自然に読める順序に並べ替える

形式:
- 元の番号を保持して、番号付きリストで返す
- 翻訳結果のみを返す（説明不要）

テキスト:
${combinedText}
  `

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
      model: model || "claude-haiku-4-5-20251001",
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

  // 番号付きリストから各翻訳を抽出
  const lines = translatedText
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);

  // 番号を除去して翻訳テキストを抽出
  const translations = lines.map((line: string) => {
    // "1. " や "1)" などの番号プレフィックスを除去
    return line.replace(/^\d+[\.\)]\s*/, "").trim();
  });

  // テキスト数が一致しない場合の処理
  if (translations.length !== texts.length) {
    console.warn(
      `翻訳結果の数が一致しません。期待: ${texts.length}, 実際: ${translations.length}`
    );
    if (translations.length === 1) {
      return Array(texts.length).fill(translatedText.trim());
    }
    while (translations.length < texts.length) {
      translations.push(translations[translations.length - 1] || "");
    }
    return translations.slice(0, texts.length);
  }

  return translations;
}

// ポップアップ → バックグラウンド間メッセージ
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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

        const result = await chrome.storage.sync.get(["claudeApiKey", "claudeModel"]);
        const apiKey = result.claudeApiKey as string | undefined;
        const model = (result.claudeModel as string) || "claude-haiku-4-5-20251001";

        if (!apiKey) {
          throw new Error("Claude APIキーが設定されていません");
        }

        console.log("[BG] Claude APIを呼び出します...");
        const translations = await callClaudeAPI(
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

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translateSelection",
    title: "選択テキストを翻訳",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "translatePageInline",
    title: "ページ全体を翻訳",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "translatePageViaGoogle",
    title: "ページ全体をGoogle翻訳で開く",
    contexts: ["page"]
  });
});


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab?.id) {
    await chrome.action.setBadgeText({ text: "✓" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 600);
  }
  
  if (info.menuItemId === 'translateSelection') {
    if (tab?.id) {
      try {
        await chrome.action.setBadgeText({ tabId: tab.id, text: "翻訳中..." });
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "TRANSLATE_SELECTION",
          targetLang: "ja"
        });
        if (response?.success) {
          await chrome.action.setBadgeText({ tabId: tab.id, text: "✓" });
          setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2000);
        } else {
          await chrome.action.setBadgeText({ tabId: tab.id, text: "✗" });
          setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2000);
        }
      } catch (error) {
        console.error("翻訳エラー:", error);
        await chrome.action.setBadgeText({ tabId: tab.id, text: "✗" });
        setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2000);
      }
    }
  }
  
  if (info.menuItemId === 'translatePageInline') {
    if (tab?.id) {
      try {
        await chrome.action.setBadgeText({ tabId: tab.id, text: "翻訳中..." });
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "TRANSLATE_PAGE",
          targetLang: "ja"
        });
        if (response?.success) {
          await chrome.action.setBadgeText({ tabId: tab.id, text: "✓" });
          setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2000);
        } else {
          await chrome.action.setBadgeText({ tabId: tab.id, text: "✗" });
          setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2000);
        }
      } catch (error) {
        console.error("翻訳エラー:", error);
        await chrome.action.setBadgeText({ tabId: tab.id, text: "✗" });
        setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2000);
      }
    }
  }
  
  if (info.menuItemId === 'translatePageViaGoogle') {
    if (tab?.url) {
      const googleTranslateUrl = `https://translate.google.com/translate?sl=auto&tl=ja&u=${encodeURIComponent(tab.url)}`;
      chrome.tabs.create({ url: googleTranslateUrl });
    }
  }
});
