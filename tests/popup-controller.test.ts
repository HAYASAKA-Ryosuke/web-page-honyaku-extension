import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPopupController, type PopupDeps, type PopupFormState, type PopupView, type PopupViewModel } from "../src/popup-controller";

function createView(initialForm?: Partial<PopupFormState>): PopupView & { lastRender: PopupViewModel | null } {
  let form: PopupFormState = {
    provider: "claude",
    apiKey: "",
    model: "claude-haiku-4-5-20251001",
    showOriginal: true,
    targetLanguage: "ja",
    menuLanguagePrimary: "ja",
    menuLanguageSecondary: "en",
    ...initialForm,
  };

  return {
    lastRender: null,
    getFormState: () => form,
    isSettingsOpen: () => true,
    setTargetLanguage(language) {
      form = {
        ...form,
        targetLanguage: language,
      };
    },
    setMenuLanguages(primary, secondary) {
      form = {
        ...form,
        menuLanguagePrimary: primary,
        menuLanguageSecondary: secondary,
      };
    },
    render(model) {
      this.lastRender = model;
      form = {
        provider: model.provider,
        apiKey: model.apiKey,
        model: model.selectedModel,
        showOriginal: model.showOriginal,
        targetLanguage: model.targetLanguage,
        menuLanguagePrimary: model.menuLanguagePrimary,
        menuLanguageSecondary: model.menuLanguageSecondary,
      };
    },
    setActionDisabled: vi.fn(),
  };
}

function createDeps(overrides?: Partial<PopupDeps>): PopupDeps {
  return {
    getManifestVersion: () => "1.3.2",
    getStoredConfig: vi.fn().mockResolvedValue({}),
    saveStoredConfig: vi.fn().mockResolvedValue(undefined),
    getActiveTabId: vi.fn().mockResolvedValue(1),
    sendTabMessage: vi.fn().mockResolvedValue({ success: true }),
    sendRuntimeMessage: vi.fn().mockResolvedValue({ success: true, translations: ["訳文"] }),
    readClipboardText: vi.fn().mockResolvedValue("hello"),
    writeClipboardText: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
    ...overrides,
  };
}

describe("popup controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders initial state from stored config and version", async () => {
    const view = createView();
    const deps = createDeps({
      getStoredConfig: vi.fn().mockResolvedValue({
        provider: "sakura",
        sakuraApiKey: "UUID:SECRET",
        sakuraModel: "llm-jp-3.1-8x13b-instruct4",
        showOriginal: false,
        targetLanguage: "th",
        menuLanguagePrimary: "th",
        menuLanguageSecondary: "ja",
      }),
    });

    const controller = createPopupController(view, deps);
    await controller.init();

    expect(view.lastRender?.provider).toBe("sakura");
    expect(view.lastRender?.apiKey).toBe("UUID:SECRET");
    expect(view.lastRender?.targetLanguage).toBe("th");
    expect(view.lastRender?.menuLanguagePrimary).toBe("th");
    expect(view.lastRender?.menuLanguageSecondary).toBe("ja");
    expect(view.lastRender?.showOriginal).toBe(false);
    expect(view.lastRender?.settingsOpen).toBe(false);
    expect(view.lastRender?.versionText).toBe("Version 1.3.2");
  });

  it("opens settings when api key is missing", async () => {
    const view = createView();
    const deps = createDeps({
      getStoredConfig: vi.fn().mockResolvedValue({
        provider: "claude",
        claudeApiKey: "",
      }),
    });

    const controller = createPopupController(view, deps);
    await controller.init();

    expect(view.lastRender?.settingsOpen).toBe(true);
    expect(view.lastRender?.settingsSummary).toContain("未設定");
  });

  it("saves config and reloads content script on target language change", async () => {
    const view = createView({
      provider: "claude",
      apiKey: "sk-ant",
      model: "claude-haiku-4-5-20251001",
      targetLanguage: "en",
      menuLanguagePrimary: "ja",
      menuLanguageSecondary: "en",
    });
    const deps = createDeps();

    const controller = createPopupController(view, deps);
    await controller.handleTargetLanguageChange();

    expect(deps.saveStoredConfig).toHaveBeenCalledWith({
      provider: "claude",
      showOriginal: true,
      targetLanguage: "en",
      menuLanguagePrimary: "ja",
      menuLanguageSecondary: "en",
      claudeApiKey: "sk-ant",
      claudeModel: "claude-haiku-4-5-20251001",
    });
    expect(deps.sendTabMessage).toHaveBeenCalledWith(1, { type: "RELOAD_CONFIG" });
  });

  it("switches target language quickly and persists selection", async () => {
    const view = createView({
      provider: "claude",
      apiKey: "sk-ant",
      model: "claude-haiku-4-5-20251001",
      targetLanguage: "ja",
      menuLanguagePrimary: "ja",
      menuLanguageSecondary: "en",
    });
    const deps = createDeps();

    const controller = createPopupController(view, deps);
    await controller.handleQuickTargetLanguageSelect("en");

    expect(view.lastRender?.targetLanguage).toBe("en");
    expect(deps.saveStoredConfig).toHaveBeenCalledWith({
      provider: "claude",
      showOriginal: true,
      targetLanguage: "en",
      menuLanguagePrimary: "ja",
      menuLanguageSecondary: "en",
      claudeApiKey: "sk-ant",
      claudeModel: "claude-haiku-4-5-20251001",
    });
  });

  it("normalizes duplicate menu languages and persists corrected values", async () => {
    const view = createView({
      provider: "claude",
      apiKey: "sk-ant",
      model: "claude-haiku-4-5-20251001",
      menuLanguagePrimary: "ja",
      menuLanguageSecondary: "ja",
    });
    const deps = createDeps();

    const controller = createPopupController(view, deps);
    await controller.handleMenuLanguagesChange();

    expect(view.lastRender?.menuLanguagePrimary).toBe("ja");
    expect(view.lastRender?.menuLanguageSecondary).toBe("en");
    expect(deps.saveStoredConfig).toHaveBeenCalledWith({
      provider: "claude",
      showOriginal: true,
      targetLanguage: "ja",
      menuLanguagePrimary: "ja",
      menuLanguageSecondary: "en",
      claudeApiKey: "sk-ant",
      claudeModel: "claude-haiku-4-5-20251001",
    });
  });

  it("uses provider-specific stored credentials on provider change", async () => {
    const view = createView({
      provider: "sakura",
      apiKey: "",
      model: "llm-jp-3.1-8x13b-instruct4",
    });
    const deps = createDeps({
      getStoredConfig: vi.fn().mockResolvedValue({
        sakuraApiKey: "UUID:SECRET",
        sakuraModel: "llm-jp-3.1-8x13b-instruct4",
      }),
    });

    const controller = createPopupController(view, deps);
    await controller.handleProviderChange();

    expect(view.lastRender?.provider).toBe("sakura");
    expect(view.lastRender?.apiKey).toBe("UUID:SECRET");
    expect(deps.saveStoredConfig).toHaveBeenCalled();
  });

});
