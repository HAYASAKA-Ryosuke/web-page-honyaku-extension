// ====== 選択テキストの翻訳 ======
import type { TranslationTarget } from "./types";
import { state } from "./state";
import { getTargetKey } from "./utils";
import { collectTargets, saveOriginalTexts } from "./target-collector";
import { translateTargetsInBatches } from "./translation";
import { addOriginalTooltip } from "./tooltip";
import { showErrorMessage, showSuccessMessage } from "./ui";
import { injectLoadingStyles } from "./styles";
import browser from "webextension-polyfill";
import { getAndClearSavedSelection } from "./saved-selection";

/**
 * 選択されたテキストを翻訳
 */
export async function translateSelection(targetLang: string = "ja"): Promise<void> {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    showErrorMessage("テキストが選択されていません", "翻訳したいテキストを選択してください");
    return;
  }

  const range = selection.getRangeAt(0);
  const selectedText = range.toString().trim();

  if (!selectedText || selectedText.length < state.config.minTextLen) {
    showErrorMessage("テキストが短すぎます", "もう少し長いテキストを選択してください");
    return;
  }

  // 選択範囲を含む要素を取得
  const container = range.commonAncestorContainer;
  let rootElement: HTMLElement;
  
  if (container.nodeType === Node.TEXT_NODE) {
    rootElement = container.parentElement || document.body;
  } else if (container instanceof HTMLElement) {
    rootElement = container;
  } else {
    rootElement = document.body;
  }

  // 選択範囲内のテキストノードを収集（グループ化を適用するためcollectTargetsを使用）
  // ただし、選択範囲内の要素のみを対象とする
  const allTargets = collectTargets(rootElement);
  const targets: TranslationTarget[] = [];
  
  for (const target of allTargets) {
    if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
      // 選択範囲と重なるかチェック
      const intersects = range.intersectsNode(target.node);
      if (intersects) {
        targets.push(target);
      }
    } else if (target.type === "text") {
      // グループ化されたテキストノードの場合、最初のノードで判定
      // get()で取得したテキストが選択範囲と重なるかチェック
      const combinedText = target.get() || "";
      if (combinedText.length > 0) {
        // 最初のテキストノードの親要素が選択範囲と重なるかチェック
        const firstNode = target.node;
        if (firstNode.nodeType === Node.TEXT_NODE) {
          const intersects = range.intersectsNode(firstNode);
          if (intersects) {
            targets.push(target);
          }
        }
      }
    } else if (target.type === "attr") {
      // 属性の場合、要素が選択範囲と重なるかチェック
      if (target.node instanceof HTMLElement) {
        const intersects = range.intersectsNode(target.node);
        if (intersects) {
          targets.push(target);
        }
      }
    }
  }

  if (targets.length === 0) {
    console.log("翻訳対象が見つかりませんでした");
    return;
  }

  // 原文を保存
  saveOriginalTexts(targets);

  // 翻訳を実行
  await translateTargetsInBatches(targets, targetLang);
  
  // ツールチップを追加
  for (const target of targets) {
    const key = getTargetKey(target);
    const translationState = state.translationState.get(key);
    if (translationState && translationState.current !== translationState.original) {
      addOriginalTooltip(target, translationState.original);
    }
  }
}

// ====== クリップボード翻訳 ======

/**
 * クリップボードの内容を翻訳
 */
export async function translateClipboard(targetLang: string = "ja"): Promise<boolean> {
  let clipboardText: string;
  try {
    clipboardText = await navigator.clipboard.readText();
  } catch {
    showErrorMessage(
      "クリップボードにアクセスできません",
      "ブラウザの権限設定を確認してください"
    );
    return false;
  }
  
  const trimmed = clipboardText?.trim() ?? "";
  if (!trimmed || trimmed.length < state.config.minTextLen) {
    showErrorMessage(
      "クリップボードにテキストがありません",
      "翻訳したいテキストをコピー（Ctrl+C）してからお試しください"
    );
    return false;
  }
  
  try {
    const translations = await state.config.provider.translate([trimmed], targetLang);
    if (translations.length > 0 && translations[0]) {
      if (targetLang === "en") {
        // 日英翻訳: 結果をクリップボードにコピー
        await navigator.clipboard.writeText(translations[0]);
        showSuccessMessage(
          "英訳をクリップボードにコピーしました",
          "Ctrl+V で貼り付けてください"
        );
      } else {
        // 英日翻訳: ポップアップで表示するため保存
        await browser.runtime.sendMessage({
          type: "STORE_CLIPBOARD_TRANSLATION",
          translation: translations[0],
        });
        showSuccessMessage(
          "翻訳しました",
          "拡張機能アイコンをクリックしてポップアップで結果を確認してください"
        );
      }
      return true;
    }
  } catch (error) {
    console.error("翻訳エラー:", error);
    showErrorMessage(
      "翻訳に失敗しました",
      error instanceof Error ? error.message : "不明なエラー"
    );
  }
  return false;
}

// ====== 選択テキストを英語に翻訳（クリップボードにコピー） ======

/**
 * 選択されたテキストを英語に翻訳してクリップボードにコピー
 * @param browserSelectionText ブラウザのコンテキストメニューから渡された選択テキスト
 */
export async function translateSelectionToEnglish(browserSelectionText?: string): Promise<void> {
  let selectedText = "";
  
  // 1. ブラウザから渡された選択テキストを優先
  if (browserSelectionText && browserSelectionText.trim().length > 0) {
    selectedText = browserSelectionText.trim();
  }
  
  // 2. 次に、右クリック時に保存した選択を使用
  if (!selectedText) {
    const saved = getAndClearSavedSelection();
    if (saved?.text) {
      selectedText = saved.text;
    }
  }
  
  // 3. 最後に、現在の選択を使用
  if (!selectedText) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selectedText = selection.toString().trim();
    }
  }

  if (!selectedText || selectedText.length < state.config.minTextLen) {
    showErrorMessage("テキストが選択されていません", "翻訳したいテキストを選択してください");
    return;
  }

  try {
    const translations = await state.config.provider.translate([selectedText], "en");
    if (translations.length > 0 && translations[0]) {
      await navigator.clipboard.writeText(translations[0]);
      showSuccessMessage(
        "英訳をクリップボードにコピーしました",
        "Ctrl+V で貼り付けてください"
      );
    } else {
      showErrorMessage("翻訳に失敗しました", "翻訳結果が空でした");
    }
  } catch (error) {
    console.error("翻訳エラー:", error);
    showErrorMessage(
      "翻訳に失敗しました",
      error instanceof Error ? error.message : "不明なエラー"
    );
  }
}

// ====== オーバーレイ表示（Google Chat等の複雑なDOM用） ======

/**
 * 翻訳結果をオーバーレイで表示
 */
function showTranslationResultOverlay(original: string, translation: string, targetLang: string): void {
  injectLoadingStyles();

  // 既存のオーバーレイを削除
  const existing = document.getElementById("translator-result-overlay");
  if (existing) existing.remove();
  const existingBackdrop = document.getElementById("translator-result-backdrop");
  if (existingBackdrop) existingBackdrop.remove();

  // オーバーレイ作成
  const overlay = document.createElement("div");
  overlay.id = "translator-result-overlay";
  overlay.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    background: #fff !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
    z-index: 2147483647 !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    max-width: 90vw !important;
    width: 500px !important;
    max-height: 80vh !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    border: 1px solid #e0e0e0 !important;
  `;

  // ヘッダー
  const header = document.createElement("div");
  header.style.cssText = `
    padding: 12px 16px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    color: #4a90e2 !important;
    border-bottom: 1px solid #eee !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
  `;
  const headerText = document.createElement("span");
  headerText.textContent = targetLang === "en" ? "日本語 → 英語" : "英語 → 日本語";
  header.appendChild(headerText);

  // 閉じるボタン
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    background: none !important;
    border: none !important;
    font-size: 20px !important;
    cursor: pointer !important;
    color: #999 !important;
    padding: 0 !important;
    line-height: 1 !important;
  `;

  // 原文セクション
  const originalSection = document.createElement("div");
  originalSection.style.cssText = `
    padding: 12px 16px !important;
    border-bottom: 1px solid #eee !important;
    background: #f9f9f9 !important;
  `;
  const originalLabel = document.createElement("div");
  originalLabel.style.cssText = `font-size: 11px !important; color: #888 !important; margin-bottom: 4px !important;`;
  originalLabel.textContent = "原文";
  const originalText = document.createElement("div");
  originalText.style.cssText = `
    font-size: 13px !important;
    line-height: 1.5 !important;
    color: #555 !important;
    max-height: 100px !important;
    overflow-y: auto !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
  `;
  originalText.textContent = original;
  originalSection.appendChild(originalLabel);
  originalSection.appendChild(originalText);

  // 翻訳結果セクション
  const translationSection = document.createElement("div");
  translationSection.style.cssText = `
    padding: 16px !important;
    flex: 1 !important;
    overflow-y: auto !important;
  `;
  const translationLabel = document.createElement("div");
  translationLabel.style.cssText = `font-size: 11px !important; color: #888 !important; margin-bottom: 4px !important;`;
  translationLabel.textContent = "翻訳結果";
  const translationText = document.createElement("div");
  translationText.style.cssText = `
    font-size: 14px !important;
    line-height: 1.6 !important;
    color: #333 !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
  `;
  translationText.textContent = translation;
  translationSection.appendChild(translationLabel);
  translationSection.appendChild(translationText);

  // アクションボタン
  const actions = document.createElement("div");
  actions.style.cssText = `
    padding: 12px 16px !important;
    border-top: 1px solid #eee !important;
    display: flex !important;
    gap: 8px !important;
    justify-content: flex-end !important;
  `;

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "クリップボードにコピー";
  copyBtn.style.cssText = `
    padding: 8px 16px !important;
    border-radius: 8px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    border: none !important;
    background: #4a90e2 !important;
    color: white !important;
  `;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(translation);
      copyBtn.textContent = "コピーしました！";
      copyBtn.style.background = "#2e7d32 !important";
      setTimeout(() => {
        copyBtn.textContent = "クリップボードにコピー";
        copyBtn.style.background = "#4a90e2 !important";
      }, 1500);
    } catch {
      copyBtn.textContent = "コピーに失敗しました";
    }
  });

  const closeBtn2 = document.createElement("button");
  closeBtn2.textContent = "閉じる";
  closeBtn2.style.cssText = `
    padding: 8px 16px !important;
    border-radius: 8px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    border: none !important;
    background: #f0f0f0 !important;
    color: #333 !important;
  `;

  actions.appendChild(copyBtn);
  actions.appendChild(closeBtn2);

  header.appendChild(closeBtn);
  overlay.appendChild(header);
  overlay.appendChild(originalSection);
  overlay.appendChild(translationSection);
  overlay.appendChild(actions);

  // バックドロップ
  const backdrop = document.createElement("div");
  backdrop.id = "translator-result-backdrop";
  backdrop.style.cssText = `
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.3) !important;
    z-index: 2147483646 !important;
  `;

  // 閉じる処理
  const closeOverlay = () => {
    overlay.remove();
    backdrop.remove();
  };
  closeBtn.addEventListener("click", closeOverlay);
  closeBtn2.addEventListener("click", closeOverlay);
  backdrop.addEventListener("click", closeOverlay);

  document.body.appendChild(backdrop);
  document.body.appendChild(overlay);
}

/**
 * 選択されたテキストを翻訳してオーバーレイで表示（Google Chat等の複雑なDOM用）
 * @param targetLang 翻訳先言語
 * @param browserSelectionText ブラウザのコンテキストメニューから渡された選択テキスト
 */
export async function translateSelectionToOverlay(targetLang: string = "ja", browserSelectionText?: string): Promise<void> {
  let selectedText = "";
  
  // 1. ブラウザから渡された選択テキストを優先
  if (browserSelectionText && browserSelectionText.trim().length > 0) {
    selectedText = browserSelectionText.trim();
    console.log("[translateSelectionToOverlay] ブラウザから取得:", selectedText.substring(0, 50));
  }
  
  // 2. 次に、右クリック時に保存した選択を使用
  if (!selectedText) {
    const saved = getAndClearSavedSelection();
    if (saved?.text) {
      selectedText = saved.text;
      console.log("[translateSelectionToOverlay] saved:", selectedText.substring(0, 50));
    }
  }
  
  // 3. 最後に、現在の選択を使用
  if (!selectedText) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selectedText = selection.toString().trim();
      console.log("[translateSelectionToOverlay] 現在の選択:", selectedText.substring(0, 50));
    }
  }

  if (!selectedText || selectedText.length < state.config.minTextLen) {
    console.log("[translateSelectionToOverlay] テキストなし, minTextLen:", state.config.minTextLen);
    showErrorMessage("テキストが選択されていません", "翻訳したいテキストを選択してください");
    return;
  }

  try {
    const translations = await state.config.provider.translate([selectedText], targetLang);
    if (translations.length > 0 && translations[0]) {
      showTranslationResultOverlay(selectedText, translations[0], targetLang);
    } else {
      showErrorMessage("翻訳に失敗しました", "翻訳結果が空でした");
    }
  } catch (error) {
    console.error("翻訳エラー:", error);
    showErrorMessage(
      "翻訳に失敗しました",
      error instanceof Error ? error.message : "不明なエラー"
    );
  }
}

