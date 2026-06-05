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
const quickTargetPrimarySelect = document.getElementById("quickTargetPrimary") as HTMLSelectElement;
const quickTargetSecondarySelect = document.getElementById("quickTargetSecondary") as HTMLSelectElement;
const menuLanguagePrimarySelect = document.getElementById("menuLanguagePrimary") as HTMLSelectElement;
const menuLanguageSecondarySelect = document.getElementById("menuLanguageSecondary") as HTMLSelectElement;
const settingsSection = document.getElementById("settingsSection") as HTMLDetailsElement;
const settingsSummary = document.getElementById("settingsSummary") as HTMLSpanElement;
const restoreBtn = document.getElementById("restoreOriginal") as HTMLButtonElement;

function createPopupView(): PopupView {
  return {
    getFormState(): PopupFormState {
      return {
        provider: providerSelect.value === "sakura" ? "sakura" : "claude",
        apiKey: apiKeyInput.value,
        model: modelSelect.value,
        showOriginal: showOriginalCheckbox.checked,
        targetLanguage: normalizeTargetLanguage(quickTargetPrimarySelect.value),
        menuLanguagePrimary: normalizeTargetLanguage(quickTargetPrimarySelect.value),
        menuLanguageSecondary: normalizeTargetLanguage(quickTargetSecondarySelect.value),
      };
    },

    isSettingsOpen(): boolean {
      return settingsSection.open;
    },

    setTargetLanguage(language): void {
      quickTargetPrimarySelect.value = language;
      menuLanguagePrimarySelect.value = language;
    },

    setMenuLanguages(primary, secondary): void {
      quickTargetPrimarySelect.value = primary;
      quickTargetSecondarySelect.value = secondary;
      menuLanguagePrimarySelect.value = primary;
      menuLanguageSecondarySelect.value = secondary;
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
      quickTargetPrimarySelect.value = model.menuLanguagePrimary;
      quickTargetSecondarySelect.value = model.menuLanguageSecondary;
      menuLanguagePrimarySelect.value = model.menuLanguagePrimary;
      menuLanguageSecondarySelect.value = model.menuLanguageSecondary;
      settingsSection.open = model.settingsOpen;
      settingsSummary.textContent = model.settingsSummary;
      versionLabel.textContent = model.versionText;
    },

    setActionDisabled(action, disabled): void {
      const actionMap = {
        translatePage: null,
        translateClipboard: null,
        restoreOriginal: restoreBtn,
        copyResult: null,
      } as const;
      actionMap[action]?.toggleAttribute("disabled", disabled);
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
    "menuLanguagePrimary",
    "menuLanguageSecondary",
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
menuLanguagePrimarySelect.addEventListener("change", () => {
  controller.handleMenuLanguagesChange();
});
menuLanguageSecondarySelect.addEventListener("change", () => {
  controller.handleMenuLanguagesChange();
});
quickTargetPrimarySelect.addEventListener("change", () => {
  controller.handleMenuLanguagesChange();
});
quickTargetSecondarySelect.addEventListener("change", () => {
  controller.handleMenuLanguagesChange();
});
restoreBtn.addEventListener("click", () => {
  controller.handleRestoreOriginal();
});

controller.init();
