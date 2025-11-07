const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const modelSelect = document.getElementById("model") as HTMLSelectElement;
const saveConfigBtn = document.getElementById("saveConfig") as HTMLButtonElement;
const translateBtn = document.getElementById("translatePage") as HTMLButtonElement;
const restoreBtn = document.getElementById("restoreOriginal") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;
const pingBtn = document.getElementById("ping") as HTMLButtonElement;
const out = document.getElementById("out") as HTMLElement;

// 設定を読み込んで表示
async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get(["claudeApiKey", "claudeModel"]);
    if (result.claudeApiKey) {
      apiKeyInput.value = result.claudeApiKey as string;
    }
    if (result.claudeModel) {
      modelSelect.value = result.claudeModel as string;
    }
  } catch (error) {
    console.error("設定の読み込みエラー:", error);
  }
}

// 設定を保存
saveConfigBtn.addEventListener("click", async () => {
  try {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!apiKey) {
      statusEl.textContent = "✗ APIキーを入力してください";
      return;
    }

    await chrome.storage.sync.set({
      claudeApiKey: apiKey,
      claudeModel: model,
    });

    statusEl.textContent = "✓ 設定を保存しました。ページをリロードしてください。";
    
    // コンテンツスクリプトに設定更新を通知
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "RELOAD_CONFIG" }).catch(() => {
        // コンテンツスクリプトが読み込まれていない場合は無視
      });
    }
  } catch (error) {
    console.error("設定の保存エラー:", error);
    statusEl.textContent = `✗ エラー: ${error instanceof Error ? error.message : "不明なエラー"}`;
  }
});

// 初期化時に設定を読み込む
loadConfig();

// ページ全体を翻訳
translateBtn.addEventListener("click", async () => {
  try {
    statusEl.textContent = "翻訳中...";
    translateBtn.disabled = true;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      statusEl.textContent = "エラー: タブが見つかりません";
      translateBtn.disabled = false;
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "TRANSLATE_PAGE",
      targetLang: "ja"
    });
    
    if (response?.success) {
      statusEl.textContent = "✓ 翻訳完了";
    } else {
      statusEl.textContent = `✗ ${response?.message || "翻訳に失敗しました"}`;
    }
  } catch (error) {
    console.error("翻訳エラー:", error);
    statusEl.textContent = `✗ エラー: ${error instanceof Error ? error.message : "不明なエラー"}`;
  } finally {
    translateBtn.disabled = false;
  }
});

// 原文に戻す
restoreBtn.addEventListener("click", async () => {
  try {
    statusEl.textContent = "復元中...";
    restoreBtn.disabled = true;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      statusEl.textContent = "エラー: タブが見つかりません";
      restoreBtn.disabled = false;
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "RESTORE_ORIGINAL"
    });
    
    if (response?.success) {
      statusEl.textContent = "✓ 原文に戻しました";
    } else {
      statusEl.textContent = `✗ ${response?.message || "復元に失敗しました"}`;
    }
  } catch (error) {
    console.error("復元エラー:", error);
    statusEl.textContent = `✗ エラー: ${error instanceof Error ? error.message : "不明なエラー"}`;
  } finally {
    restoreBtn.disabled = false;
  }
});

// Pingボタン（既存機能）
pingBtn.addEventListener("click", async () => {
  const res = await chrome.runtime.sendMessage({ type: "PING" });
  out.textContent = JSON.stringify(res);
});

