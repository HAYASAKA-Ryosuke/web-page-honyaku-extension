import {
  normalizeLanguagePair,
  normalizeTargetLanguage,
  type SupportedLanguage,
} from "./languages";

export type ProviderId = "claude" | "sakura";

const DEFAULT_PROVIDER: ProviderId = "claude";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_SAKURA_MODEL = "llm-jp-3.1-8x13b-instruct4";

type StoredConfig = {
  provider?: unknown;
  claudeApiKey?: string;
  claudeModel?: string;
  sakuraApiKey?: string;
  sakuraModel?: string;
  showOriginal?: boolean;
  targetLanguage?: unknown;
  menuLanguagePrimary?: unknown;
  menuLanguageSecondary?: unknown;
  lastClipboardTranslation?: { translation: string };
};

export type PopupFormState = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  showOriginal: boolean;
  targetLanguage: SupportedLanguage;
  menuLanguagePrimary: SupportedLanguage;
  menuLanguageSecondary: SupportedLanguage;
};

type ProviderOption = {
  value: string;
  label: string;
};

type ProviderMeta = {
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  models: ProviderOption[];
};

export type PopupViewModel = {
  provider: ProviderId;
  apiKey: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  modelOptions: ProviderOption[];
  selectedModel: string;
  showModelRow: boolean;
  showOriginal: boolean;
  targetLanguage: SupportedLanguage;
  menuLanguagePrimary: SupportedLanguage;
  menuLanguageSecondary: SupportedLanguage;
  settingsOpen: boolean;
  settingsSummary: string;
  versionText: string;
};

export interface PopupView {
  getFormState(): PopupFormState;
  getClipboardResult(): string;
  isSettingsOpen(): boolean;
  render(model: PopupViewModel): void;
  setTargetLanguage(language: SupportedLanguage): void;
  setMenuLanguages(primary: SupportedLanguage, secondary: SupportedLanguage): void;
  setClipboardResult(text: string): void;
  setActionDisabled(action: "translatePage" | "translateClipboard" | "restoreOriginal" | "copyResult", disabled: boolean): void;
  flashCopyResultCopied(): void;
}

export interface PopupDeps {
  getManifestVersion(): string;
  getStoredConfig(): Promise<StoredConfig>;
  saveStoredConfig(config: Record<string, string | boolean>): Promise<void>;
  getActiveTabId(): Promise<number | null>;
  sendTabMessage(tabId: number, message: Record<string, unknown>): Promise<{ success?: boolean; message?: string } | undefined>;
  sendRuntimeMessage(message: Record<string, unknown>): Promise<{ success?: boolean; translations?: string[]; error?: string } | undefined>;
  readClipboardText(): Promise<string>;
  writeClipboardText(text: string): Promise<void>;
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

function getProviderMeta(provider: ProviderId): ProviderMeta {
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

function getProviderLabel(provider: ProviderId): string {
  return provider === "sakura" ? "Sakura AI" : "Claude";
}

function buildSettingsSummary(provider: ProviderId, apiKey: string): string {
  return `(${getProviderLabel(provider)} / APIキー${apiKey.trim().length > 0 ? "設定済み" : "未設定"})`;
}

function buildViewModel(
  form: PopupFormState,
  options?: { settingsOpen?: boolean; versionText?: string }
): PopupViewModel {
  const meta = getProviderMeta(form.provider);
  const hasSelectedModel = meta.models.some((item) => item.value === form.model);
  const selectedModel = hasSelectedModel ? form.model : (meta.models[0]?.value ?? "");

  return {
    provider: form.provider,
    apiKey: form.apiKey,
    apiKeyLabel: meta.apiKeyLabel,
    apiKeyPlaceholder: meta.apiKeyPlaceholder,
    modelOptions: meta.models,
    selectedModel,
    showModelRow: meta.models.length > 1,
    showOriginal: form.showOriginal,
    targetLanguage: form.targetLanguage,
    menuLanguagePrimary: form.menuLanguagePrimary,
    menuLanguageSecondary: form.menuLanguageSecondary,
    settingsOpen: options?.settingsOpen ?? false,
    settingsSummary: buildSettingsSummary(form.provider, form.apiKey),
    versionText: options?.versionText ?? "",
  };
}

function formFromStoredConfig(result: StoredConfig): PopupFormState {
  const provider = normalizeProvider(result.provider);
  const apiKey = provider === "sakura"
    ? result.sakuraApiKey ?? ""
    : result.claudeApiKey ?? "";
  const model = provider === "sakura"
    ? result.sakuraModel || DEFAULT_SAKURA_MODEL
    : result.claudeModel || DEFAULT_CLAUDE_MODEL;

  const menuLanguages = normalizeLanguagePair(
    result.menuLanguagePrimary,
    result.menuLanguageSecondary,
  );

  return {
    provider,
    apiKey,
    model,
    showOriginal: result.showOriginal !== false,
    targetLanguage: menuLanguages.primary,
    menuLanguagePrimary: menuLanguages.primary,
    menuLanguageSecondary: menuLanguages.secondary,
  };
}

function storedConfigFromForm(form: PopupFormState): Record<string, string | boolean> {
  const menuLanguages = normalizeLanguagePair(form.menuLanguagePrimary, form.menuLanguageSecondary);
  const nextConfig: Record<string, string | boolean> = {
    provider: form.provider,
    showOriginal: form.showOriginal,
    targetLanguage: form.targetLanguage,
    menuLanguagePrimary: menuLanguages.primary,
    menuLanguageSecondary: menuLanguages.secondary,
  };

  if (form.provider === "sakura") {
    nextConfig.sakuraApiKey = form.apiKey.trim();
    nextConfig.sakuraModel = form.model;
  } else {
    nextConfig.claudeApiKey = form.apiKey.trim();
    nextConfig.claudeModel = form.model;
  }

  return nextConfig;
}

async function notifyConfigReload(deps: PopupDeps): Promise<void> {
  const tabId = await deps.getActiveTabId();
  if (tabId == null) {
    return;
  }

  try {
    await deps.sendTabMessage(tabId, { type: "RELOAD_CONFIG" });
  } catch {
    // コンテンツスクリプトが読み込まれていない場合は無視
  }
}

export function createPopupController(view: PopupView, deps: PopupDeps) {
  async function saveCurrentForm(): Promise<void> {
    const form = view.getFormState();
    await deps.saveStoredConfig(storedConfigFromForm(form));
    await notifyConfigReload(deps);
  }

  return {
    async init(): Promise<void> {
      const result = await deps.getStoredConfig();
      const form = formFromStoredConfig(result);
      const model = buildViewModel(form, {
        settingsOpen: form.apiKey.trim().length === 0,
        versionText: `Version ${deps.getManifestVersion()}`,
      });
      view.render(model);

      if (result.lastClipboardTranslation?.translation) {
        view.setClipboardResult(result.lastClipboardTranslation.translation);
      }
    },

    async handleProviderChange(): Promise<void> {
      const currentForm = view.getFormState();
      const settingsOpen = view.isSettingsOpen();
      const result = await deps.getStoredConfig();
      const provider = currentForm.provider;
      const nextApiKey = provider === "sakura"
        ? result.sakuraApiKey ?? ""
        : result.claudeApiKey ?? "";
      const nextModel = provider === "sakura"
        ? result.sakuraModel || DEFAULT_SAKURA_MODEL
        : result.claudeModel || DEFAULT_CLAUDE_MODEL;
      const nextForm: PopupFormState = {
        ...currentForm,
        provider,
        apiKey: nextApiKey,
        model: nextModel,
      };

      view.render(buildViewModel(nextForm, {
        settingsOpen,
        versionText: `Version ${deps.getManifestVersion()}`,
      }));
      await saveCurrentForm();
    },

    handleApiKeyInput(): void {
      const form = view.getFormState();
      view.render(buildViewModel(form, {
        settingsOpen: view.isSettingsOpen(),
        versionText: `Version ${deps.getManifestVersion()}`,
      }));
    },

    async handleApiKeyBlur(): Promise<void> {
      await saveCurrentForm();
    },

    async handleModelChange(): Promise<void> {
      await saveCurrentForm();
    },

    async handleShowOriginalChange(): Promise<void> {
      await saveCurrentForm();
    },

    async handleMenuLanguagesChange(): Promise<void> {
      const currentForm = view.getFormState();
      const menuLanguages = normalizeLanguagePair(
        currentForm.menuLanguagePrimary,
        currentForm.menuLanguageSecondary,
      );
      view.setMenuLanguages(menuLanguages.primary, menuLanguages.secondary);
      const nextForm = view.getFormState();
      view.render(buildViewModel(nextForm, {
        settingsOpen: view.isSettingsOpen(),
        versionText: `Version ${deps.getManifestVersion()}`,
      }));
      await saveCurrentForm();
    },

    async handleTargetLanguageChange(): Promise<void> {
      const form = view.getFormState();
      view.render(buildViewModel(form, {
        settingsOpen: view.isSettingsOpen(),
        versionText: `Version ${deps.getManifestVersion()}`,
      }));
      await saveCurrentForm();
    },

    async handleQuickTargetLanguageSelect(targetLanguage: SupportedLanguage): Promise<void> {
      view.setTargetLanguage(targetLanguage);
      const form = view.getFormState();
      view.render(buildViewModel(form, {
        settingsOpen: view.isSettingsOpen(),
        versionText: `Version ${deps.getManifestVersion()}`,
      }));
      await saveCurrentForm();
    },

    async handleTranslatePage(): Promise<void> {
      view.setActionDisabled("translatePage", true);

      try {
        const tabId = await deps.getActiveTabId();
        if (tabId == null) {
          deps.error("エラー: タブが見つかりません");
          return;
        }

        const form = view.getFormState();
        const response = await deps.sendTabMessage(tabId, {
          type: "TRANSLATE_PAGE",
          targetLang: form.targetLanguage,
        });

        if (response?.success) {
          deps.log("✓ 翻訳完了");
        } else {
          deps.error(`✗ ${response?.message || "翻訳に失敗しました"}`);
        }
      } catch (error) {
        deps.error("翻訳エラー:", error);
      } finally {
        view.setActionDisabled("translatePage", false);
      }
    },

    async handleTranslateClipboard(): Promise<void> {
      view.setActionDisabled("translateClipboard", true);

      try {
        const text = await deps.readClipboardText();
        const trimmed = text.trim();
        if (!trimmed) {
          view.setClipboardResult("クリップボードにテキストがありません。");
          return;
        }

        const form = view.getFormState();
        const response = await deps.sendRuntimeMessage({
          type: "TRANSLATE_TEXTS",
          texts: [trimmed],
          targetLang: form.targetLanguage,
        });

        if (response?.success && response.translations?.length) {
          view.setClipboardResult(response.translations[0] ?? "");
        } else {
          view.setClipboardResult(response?.error ?? "翻訳に失敗しました");
        }
      } catch (error) {
        view.setClipboardResult(error instanceof Error ? error.message : "翻訳に失敗しました");
      } finally {
        view.setActionDisabled("translateClipboard", false);
      }
    },

    async handleCopyResult(): Promise<void> {
      const text = view.getClipboardResult().trim();
      if (!text) {
        return;
      }

      view.setActionDisabled("copyResult", true);
      try {
        await deps.writeClipboardText(text);
        view.flashCopyResultCopied();
      } finally {
        view.setActionDisabled("copyResult", false);
      }
    },

    async handleRestoreOriginal(): Promise<void> {
      view.setActionDisabled("restoreOriginal", true);

      try {
        const tabId = await deps.getActiveTabId();
        if (tabId == null) {
          deps.error("エラー: タブが見つかりません");
          return;
        }

        const response = await deps.sendTabMessage(tabId, {
          type: "RESTORE_ORIGINAL",
        });

        if (response?.success) {
          deps.log("✓ 原文に戻しました");
        } else {
          deps.error(`✗ ${response?.message || "復元に失敗しました"}`);
        }
      } catch (error) {
        deps.error("復元エラー:", error);
      } finally {
        view.setActionDisabled("restoreOriginal", false);
      }
    },
  };
}
