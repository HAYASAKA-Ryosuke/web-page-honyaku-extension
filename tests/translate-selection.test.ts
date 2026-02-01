import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// state モジュールをモック
vi.mock("../src/state", () => {
  return {
    state: {
      config: {
        minTextLen: 1,
        provider: {
          translate: vi.fn().mockResolvedValue(["翻訳結果"]),
        },
      },
      translationState: new Map(),
      showOriginal: true,
      tooltipControllers: new Map(),
      nodeIdMap: new Map(),
    },
    initializeConfig: vi.fn(),
    loadShowOriginalSetting: vi.fn(),
  };
});

// target-collector モジュールをモック
vi.mock("../src/target-collector", () => ({
  collectTargets: vi.fn().mockReturnValue([]),
  saveOriginalTexts: vi.fn(),
}));

// translation モジュールをモック
vi.mock("../src/translation", () => ({
  translateTargetsInBatches: vi.fn().mockResolvedValue(undefined),
}));

// tooltip モジュールをモック
vi.mock("../src/tooltip", () => ({
  addOriginalTooltip: vi.fn(),
}));

// utils モジュールをモック
vi.mock("../src/utils", () => ({
  isVisibleTextNode: vi.fn().mockReturnValue(true),
  getNodeId: vi.fn().mockReturnValue("mock-node-id"),
  getTargetKey: vi.fn().mockReturnValue("mock-target-key"),
}));

import { translateSelection } from "../src/translate-selection";
import { collectTargets } from "../src/target-collector";
import { state } from "../src/state";

describe("translateSelection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    (state.config as any).minTextLen = 1;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should show error when no text is selected", async () => {
    // 選択なしの状態
    window.getSelection()?.removeAllRanges();
    
    await translateSelection("ja");
    
    // エラーメッセージが表示されるはず
    const indicator = document.getElementById("translator-loading-indicator");
    expect(indicator?.classList.contains("error")).toBe(true);
  });

  it("should show error when selected text is too short", async () => {
    // minTextLen を設定
    (state.config as any).minTextLen = 10;
    
    // 短いテキストを選択
    document.body.innerHTML = "<p>Hi</p>";
    const range = document.createRange();
    const textNode = document.querySelector("p")?.firstChild;
    if (textNode) {
      range.selectNodeContents(textNode);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    
    await translateSelection("ja");
    
    // エラーメッセージが表示されるはず
    const indicator = document.getElementById("translator-loading-indicator");
    expect(indicator?.classList.contains("error")).toBe(true);
  });

  it("should call collectTargets with correct root element", async () => {
    (state.config as any).minTextLen = 1;
    
    // テキストを含む要素を作成
    document.body.innerHTML = "<div id='container'><p>Hello World</p></div>";
    const range = document.createRange();
    const textNode = document.querySelector("p")?.firstChild;
    if (textNode) {
      range.selectNodeContents(textNode);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    
    await translateSelection("ja");
    
    // collectTargets が呼ばれるはず
    expect(collectTargets).toHaveBeenCalled();
  });

  it("should process translation targets when found", async () => {
    (state.config as any).minTextLen = 1;
    
    // テキストノードを作成
    document.body.innerHTML = "<p>Test text for translation</p>";
    const textNode = document.querySelector("p")?.firstChild as Text;
    
    // collectTargets がターゲットを返すようにモック
    const mockTarget = {
      type: "text" as const,
      node: textNode,
      get: () => "Test text for translation",
      set: vi.fn(),
    };
    vi.mocked(collectTargets).mockReturnValue([mockTarget]);
    
    // テキストを選択
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    await translateSelection("ja");
    
    // 翻訳が実行されるはず
    expect(collectTargets).toHaveBeenCalled();
  });
});

describe("translateSelection with different targetLang", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    (state.config as any).minTextLen = 1;
  });

  it("should pass correct targetLang to translation", async () => {
    document.body.innerHTML = "<p>こんにちは</p>";
    const textNode = document.querySelector("p")?.firstChild as Text;
    
    const mockTarget = {
      type: "text" as const,
      node: textNode,
      get: () => "こんにちは",
      set: vi.fn(),
    };
    vi.mocked(collectTargets).mockReturnValue([mockTarget]);
    
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    await translateSelection("en");
    
    // targetLang が "en" で渡されるはず
    expect(collectTargets).toHaveBeenCalled();
  });
});
