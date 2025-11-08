const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const modelSelect = document.getElementById("model") as HTMLSelectElement;
const showOriginalCheckbox = document.getElementById("showOriginal") as HTMLInputElement;
const translateBtn = document.getElementById("translatePage") as HTMLButtonElement;
const restoreBtn = document.getElementById("restoreOriginal") as HTMLButtonElement;

// 設定を読み込んで表示
async function loadConfig() {
  const result = await chrome.storage.local.get(["claudeApiKey", "claudeModel", "showOriginal"]);
  if (result.claudeApiKey) {
    apiKeyInput.value = result.claudeApiKey as string;
  }
  if (result.claudeModel) {
    modelSelect.value = result.claudeModel as string;
  }
  // 原文表示の設定（デフォルトはtrue）
  showOriginalCheckbox.checked = result.showOriginal !== false;
}

// 設定を自動保存する関数
async function saveConfig(): Promise<void> {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  // APIキーが空の場合は保存しない
  if (!apiKey) {
    return;
  }

  await chrome.storage.local.set({
    claudeApiKey: apiKey,
    claudeModel: model,
    showOriginal: showOriginalCheckbox.checked,
  });

  // コンテンツスクリプトに設定更新を通知
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "RELOAD_CONFIG" }).catch(() => {
      // コンテンツスクリプトが読み込まれていない場合は無視
    });
  }
}

// 各入力フィールドの変更時に自動保存
apiKeyInput.addEventListener("blur", saveConfig);
modelSelect.addEventListener("change", saveConfig);
showOriginalCheckbox.addEventListener("change", saveConfig);

// 初期化時に設定を読み込む
loadConfig();

// ページ全体を翻訳
translateBtn.addEventListener("click", async () => {
  try {
    translateBtn.disabled = true;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      console.error("エラー: タブが見つかりません");
      translateBtn.disabled = false;
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "TRANSLATE_PAGE",
      targetLang: "ja"
    });
    
    if (response?.success) {
      console.log("✓ 翻訳完了");
    } else {
      console.error(`✗ ${response?.message || "翻訳に失敗しました"}`);
    }
  } catch (error) {
    console.error("翻訳エラー:", error);
  } finally {
    translateBtn.disabled = false;
  }
});

// 原文に戻す
restoreBtn.addEventListener("click", async () => {
  try {
    restoreBtn.disabled = true;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      console.error("エラー: タブが見つかりません");
      restoreBtn.disabled = false;
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "RESTORE_ORIGINAL"
    });
    
    if (response?.success) {
      console.log("✓ 原文に戻しました");
    } else {
      console.error(`✗ ${response?.message || "復元に失敗しました"}`);
    }
  } catch (error) {
    console.error("復元エラー:", error);
  } finally {
    restoreBtn.disabled = false;
  }
});

