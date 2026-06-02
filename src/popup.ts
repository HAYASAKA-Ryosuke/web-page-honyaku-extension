import browser from "webextension-polyfill";
import { createPopupController, type PopupFormState, type PopupView, type PopupViewModel } from "./popup-controller";
import { normalizeTargetLanguage } from "./languages";

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

function createPopupView(): PopupView {
  return {
    getFormState(): PopupFormState {
      return {
        provider: providerSelect.value === "sakura" ? "sakura" : "claude",
        apiKey: apiKeyInput.value,
        model: modelSelect.value,
        showOriginal: showOriginalCheckbox.checked,
        targetLanguage: normalizeTargetLanguage(targetLanguageSelect.value),
      };
    },

    getClipboardResult(): string {
      return clipboardResult.textContent ?? "";
    },

    isSettingsOpen(): boolean {
      return settingsSection.open;
    },

    render(model: PopupViewModel): void {
      providerSelect.value = model.provider;
      apiKeyInput.value = model.apiKey;
      apiKeyLabel.textContent = model.apiKeyLabel;
      apiKeyInput.placeholder = model.apiKeyPlaceholder;
      modelSelect.innerHTML = "";

      for (const option of model.modelOptions) {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        modelSelect.appendChild(element);
      }

      modelSelect.value = model.selectedModel;
      modelRow.style.display = model.showModelRow ? "block" : "none";
      showOriginalCheckbox.checked = model.showOriginal;
      targetLanguageSelect.value = model.targetLanguage;
      settingsSection.open = model.settingsOpen;
      settingsSummary.textContent = model.settingsSummary;
      versionLabel.textContent = model.versionText;

      const label = targetLanguageSelect.selectedOptions[0]?.textContent ?? "";
      translateBtn.textContent = `ページ全体を${label}に翻訳`;
      translateClipboardBtn.textContent = `クリップボード→${label}`;
    },

    setClipboardResult(text: string): void {
      clipboardResult.textContent = text;
      clipboardResultRow.style.display = "block";
    },

    setActionDisabled(action, disabled): void {
      const actionMap = {
        translatePage: translateBtn,
        translateClipboard: translateClipboardBtn,
        restoreOriginal: restoreBtn,
        copyResult: copyResultBtn,
      } as const;
      actionMap[action].disabled = disabled;
    },

    flashCopyResultCopied(): void {
      const originalText = copyResultBtn.textContent;
      copyResultBtn.textContent = "コピーしました！";
      window.setTimeout(() => {
        copyResultBtn.textContent = originalText;
      }, 1500);
    },
  };
}

const controller = createPopupController(createPopupView(), {
  getManifestVersion: () => browser.runtime.getManifest().version,
  getStoredConfig: () => browser.storage.local.get([
    "provider",
    "claudeApiKey",
    "claudeModel",
    "sakuraApiKey",
    "sakuraModel",
    "showOriginal",
    "targetLanguage",
    "lastClipboardTranslation",
  ]),
  saveStoredConfig: (config) => browser.storage.local.set(config),
  async getActiveTabId() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  },
  sendTabMessage: (tabId, message) => browser.tabs.sendMessage(tabId, message),
  sendRuntimeMessage: (message) => browser.runtime.sendMessage(message),
  readClipboardText: () => navigator.clipboard.readText(),
  writeClipboardText: (text) => navigator.clipboard.writeText(text),
  log: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
});

providerSelect.addEventListener("change", () => {
  controller.handleProviderChange();
});
apiKeyInput.addEventListener("input", () => {
  controller.handleApiKeyInput();
});
apiKeyInput.addEventListener("blur", () => {
  controller.handleApiKeyBlur();
});
modelSelect.addEventListener("change", () => {
  controller.handleModelChange();
});
showOriginalCheckbox.addEventListener("change", () => {
  controller.handleShowOriginalChange();
});
targetLanguageSelect.addEventListener("change", () => {
  controller.handleTargetLanguageChange();
});
translateBtn.addEventListener("click", () => {
  controller.handleTranslatePage();
});
translateClipboardBtn.addEventListener("click", () => {
  controller.handleTranslateClipboard();
});
copyResultBtn.addEventListener("click", () => {
  controller.handleCopyResult();
});
restoreBtn.addEventListener("click", () => {
  controller.handleRestoreOriginal();
});

controller.init();
