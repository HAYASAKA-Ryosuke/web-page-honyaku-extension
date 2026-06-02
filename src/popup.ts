import browser from "webextension-polyfill";
import {
  getLanguageNativeLabel,
  normalizeTargetLanguage,
  type SupportedLanguage,
} from "./languages";

type ProviderId = "claude" | "sakura";

const DEFAULT_PROVIDER: ProviderId = "claude";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_SAKURA_MODEL = "llm-jp-3.1-8x13b-instruct4";

const providerSelect = document.getElementById("provider") as HTMLSelectElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const modelSelect = document.getElementById("model") as HTMLSelectElement;
const modelRow = document.getElementById("modelRow") as HTMLDivElement;
const apiKeyLabel = document.getElementById("apiKeyLabel") as HTMLLabelElement;
const versionLabel = document.getElementById("version") as HTMLDivElement;
const showOriginalCheckbox = document.getElementById("showOriginal") as HTMLInputElement;
const targetLanguageSelect = document.getElementById("targetLanguage") as HTMLSelectElement;
const settingsSection = document.getElementById("settingsSection") as HTMLDetailsElement;
const settingsSummary = document.getElementById("settingsSummary") as HTMLSpanElement;
const translateBtn = document.getElementById("translatePage") as HTMLButtonElement;
const translateClipboardBtn = document.getElementById("translateClipboard") as HTMLButtonElement;
const clipboardResultRow = document.getElementById("clipboardResultRow") as HTMLDivElement;
const clipboardResult = document.getElementById("clipboardResult") as HTMLDivElement;
const copyResultBtn = document.getElementById("copyResult") as HTMLButtonElement;
const restoreBtn = document.getElementById("restoreOriginal") as HTMLButtonElement;

function getProviderMeta(provider: ProviderId): {
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  models: Array<{ value: string; label: string }>;
} {
  if (provider === "sakura") {
    return {
      apiKeyLabel: "Sakura AI API Key",
      apiKeyPlaceholder: "UUID:SECRET",
      models: [
        {
          value: DEFAULT_SAKURA_MODEL,
          label: "llm-jp-3.1-8x13b-instruct4",
        },
      ],
    };
  }

  return {
    apiKeyLabel: "Claude API Key",
    apiKeyPlaceholder: "sk-ant-...",
    models: [
      {
        value: DEFAULT_CLAUDE_MODEL,
        label: "Claude 4.5 Haiku",
      },
    ],
  };
}

function normalizeProvider(value: unknown): ProviderId {
  return value === "sakura" ? "sakura" : DEFAULT_PROVIDER;
}

function renderModelOptions(provider: ProviderId, selectedModel?: string): void {
  const meta = getProviderMeta(provider);
  modelSelect.innerHTML = "";

  for (const option of meta.models) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    modelSelect.appendChild(element);
  }

  const nextModel = selectedModel && meta.models.some((item) => item.value === selectedModel)
    ? selectedModel
    : meta.models[0]?.value;

  if (nextModel) {
    modelSelect.value = nextModel;
  }

  modelRow.style.display = meta.models.length > 1 ? "block" : "none";
}

function applyProviderUI(provider: ProviderId, selectedModel?: string): void {
  const meta = getProviderMeta(provider);
  providerSelect.value = provider;
  apiKeyLabel.textContent = meta.apiKeyLabel;
  apiKeyInput.placeholder = meta.apiKeyPlaceholder;
  renderModelOptions(provider, selectedModel);
  updateSettingsSummary();
}

function getProviderLabel(provider: ProviderId): string {
  return provider === "sakura" ? "Sakura AI" : "Claude";
}

function updateSettingsSummary(): void {
  const provider = normalizeProvider(providerSelect.value);
  const hasApiKey = apiKeyInput.value.trim().length > 0;
  settingsSummary.textContent = `(${getProviderLabel(provider)} / APIキー${hasApiKey ? "設定済み" : "未設定"})`;
}

// 設定を読み込んで表示
async function loadConfig() {
  const result = await browser.storage.local.get([
    "provider",
    "claudeApiKey",
    "claudeModel",
    "sakuraApiKey",
    "sakuraModel",
    "showOriginal",
    "targetLanguage",
  ]);
  const provider = normalizeProvider(result.provider);
  const apiKey = provider === "sakura"
    ? (result.sakuraApiKey as string | undefined)
    : (result.claudeApiKey as string | undefined);
  const model = provider === "sakura"
    ? (result.sakuraModel as string | undefined)
    : (result.claudeModel as string | undefined);

  applyProviderUI(provider, model);

  if (apiKey) {
    apiKeyInput.value = apiKey;
  }
  showOriginalCheckbox.checked = result.showOriginal !== false;
  targetLanguageSelect.value = normalizeTargetLanguage(result.targetLanguage);
  updateTargetLanguageUI();
  updateSettingsSummary();
  settingsSection.open = !apiKey;
}

// 設定を自動保存する関数
async function saveConfig(): Promise<void> {
  const provider = normalizeProvider(providerSelect.value);
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const targetLanguage = normalizeTargetLanguage(targetLanguageSelect.value);
  const nextConfig: Record<string, string | boolean> = {
    provider,
    showOriginal: showOriginalCheckbox.checked,
    targetLanguage,
  };

  if (provider === "sakura") {
    nextConfig.sakuraApiKey = apiKey;
    nextConfig.sakuraModel = model;
  } else {
    nextConfig.claudeApiKey = apiKey;
    nextConfig.claudeModel = model;
  }

  await browser.storage.local.set(nextConfig);

  // コンテンツスクリプトに設定更新を通知
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    browser.tabs.sendMessage(tab.id, { type: "RELOAD_CONFIG" }).catch(() => {
      // コンテンツスクリプトが読み込まれていない場合は無視
    });
  }
}

// 各入力フィールドの変更時に自動保存
providerSelect.addEventListener("change", async () => {
  const provider = normalizeProvider(providerSelect.value);
  const result = await browser.storage.local.get([
    "claudeApiKey",
    "claudeModel",
    "sakuraApiKey",
    "sakuraModel",
  ]);
  const apiKey = provider === "sakura"
    ? (result.sakuraApiKey as string | undefined)
    : (result.claudeApiKey as string | undefined);
  const model = provider === "sakura"
    ? (result.sakuraModel as string | undefined)
    : (result.claudeModel as string | undefined);

  applyProviderUI(provider, model);
  apiKeyInput.value = apiKey || "";
  updateSettingsSummary();
  await saveConfig();
});
apiKeyInput.addEventListener("input", updateSettingsSummary);
apiKeyInput.addEventListener("blur", saveConfig);
modelSelect.addEventListener("change", saveConfig);
showOriginalCheckbox.addEventListener("change", saveConfig);
targetLanguageSelect.addEventListener("change", async () => {
  updateTargetLanguageUI();
  await saveConfig();
});

function getSelectedTargetLanguage(): SupportedLanguage {
  return normalizeTargetLanguage(targetLanguageSelect.value);
}

function updateTargetLanguageUI(): void {
  const label = getLanguageNativeLabel(getSelectedTargetLanguage());
  translateBtn.textContent = `ページ全体を${label}に翻訳`;
  translateClipboardBtn.textContent = `クリップボード→${label}`;
}

// クリップボード翻訳結果をポップアップに表示
function showClipboardTranslation(translation: string): void {
  clipboardResult.textContent = translation;
  clipboardResultRow.style.display = "block";
}

// 初期化時に設定を読み込む & 保存済みのクリップボード翻訳結果を表示
async function init() {
  const manifest = browser.runtime.getManifest();
  versionLabel.textContent = `Version ${manifest.version}`;

  await loadConfig();
  const result = await browser.storage.local.get(["lastClipboardTranslation"]);
  const data = result.lastClipboardTranslation as { translation: string } | undefined;
  if (data?.translation) {
    showClipboardTranslation(data.translation);
  }
}
init();

// ページ全体を翻訳
translateBtn.addEventListener("click", async () => {
  try {
    translateBtn.disabled = true;
    
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      console.error("エラー: タブが見つかりません");
      translateBtn.disabled = false;
      return;
    }
    
    const response = await browser.tabs.sendMessage(tab.id, {
      type: "TRANSLATE_PAGE",
      targetLang: getSelectedTargetLanguage(),
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

// クリップボードを翻訳する共通関数
async function translateClipboardWithLang(targetLang: SupportedLanguage, btn: HTMLButtonElement): Promise<void> {
  try {
    btn.disabled = true;
    const text = await navigator.clipboard.readText();
    const trimmed = text?.trim() ?? "";
    if (!trimmed) {
      clipboardResult.textContent = "クリップボードにテキストがありません。";
      clipboardResultRow.style.display = "block";
      btn.disabled = false;
      return;
    }
    const response = await browser.runtime.sendMessage({
      type: "TRANSLATE_TEXTS",
      texts: [trimmed],
      targetLang,
    });
    if (response?.success && response.translations?.length > 0) {
      showClipboardTranslation(response.translations[0]);
    } else {
      clipboardResult.textContent = response?.error ?? "翻訳に失敗しました";
      clipboardResultRow.style.display = "block";
    }
  } catch (error) {
    clipboardResult.textContent = error instanceof Error ? error.message : "翻訳に失敗しました";
    clipboardResultRow.style.display = "block";
  } finally {
    btn.disabled = false;
  }
}

translateClipboardBtn.addEventListener("click", () => {
  translateClipboardWithLang(getSelectedTargetLanguage(), translateClipboardBtn);
});

// 翻訳結果をクリップボードにコピー
copyResultBtn.addEventListener("click", async () => {
  const text = clipboardResult.textContent;
  if (text) {
    await navigator.clipboard.writeText(text);
    const originalText = copyResultBtn.textContent;
    copyResultBtn.textContent = "コピーしました！";
    setTimeout(() => {
      copyResultBtn.textContent = originalText;
    }, 1500);
  }
});

// 原文に戻す
restoreBtn.addEventListener("click", async () => {
  try {
    restoreBtn.disabled = true;
    
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      console.error("エラー: タブが見つかりません");
      restoreBtn.disabled = false;
      return;
    }
    
    const response = await browser.tabs.sendMessage(tab.id, {
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
