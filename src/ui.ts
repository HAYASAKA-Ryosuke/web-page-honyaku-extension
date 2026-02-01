// ====== UI関連（ローディングインジケーター、エラーメッセージ、翻訳中マーカー） ======
import type { TranslationTarget } from "./types";
import { injectLoadingStyles } from "./styles";

/**
 * 翻訳中インジケーターを表示
 */
export function showLoadingIndicator(totalBatches: number, currentBatch: number): void {
  injectLoadingStyles();
  
  let indicator = document.getElementById("translator-loading-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "translator-loading-indicator";
    indicator.className = "translator-loading-indicator";
    document.body.appendChild(indicator);
  }
  
  // エラー状態をリセット
  indicator.classList.remove("error", "warning");
  
  const spinner = document.createElement("div");
  spinner.className = "translator-loading-spinner";
  
  const text = document.createElement("span");
  if (totalBatches > 1) {
    text.textContent = `翻訳中... (${currentBatch}/${totalBatches})`;
  } else {
    text.textContent = "翻訳中...";
  }
  
  indicator.innerHTML = "";
  indicator.appendChild(spinner);
  indicator.appendChild(text);
}

/**
 * エラーメッセージを表示
 */
export function showErrorMessage(message: string, details?: string): void {
  injectLoadingStyles();
  
  let indicator = document.getElementById("translator-loading-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "translator-loading-indicator";
    indicator.className = "translator-loading-indicator error";
    document.body.appendChild(indicator);
  } else {
    indicator.className = "translator-loading-indicator error";
  }
  
  const icon = document.createElement("span");
  icon.textContent = "⚠️";
  icon.style.fontSize = "18px";
  
  const text = document.createElement("span");
  text.textContent = message;
  
  indicator.innerHTML = "";
  indicator.appendChild(icon);
  indicator.appendChild(text);
  
  if (details) {
    const detailEl = document.createElement("div");
    detailEl.className = "translator-error-message";
    detailEl.textContent = details;
    indicator.appendChild(detailEl);
  }
  
  // 3秒後に自動的に非表示
  setTimeout(() => {
    if (indicator && indicator.parentNode) {
      indicator.remove();
    }
  }, 3000);
}

/**
 * 成功メッセージを表示（ポップアップで確認するよう促すなど）
 * インラインスタイルを使用して、どのサイトでも確実に表示されるようにする
 */
export function showSuccessMessage(message: string, details?: string): void {
  // 既存の通知を削除
  const existing = document.getElementById("translator-success-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "translator-success-toast";
  toast.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: #2e7d32 !important;
    color: white !important;
    padding: 12px 20px !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    z-index: 2147483647 !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    max-width: 400px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    animation: translator-toast-in 0.3s ease-out !important;
  `;

  // アニメーション用スタイルを追加
  if (!document.getElementById("translator-toast-animation")) {
    const animStyle = document.createElement("style");
    animStyle.id = "translator-toast-animation";
    animStyle.textContent = `
      @keyframes translator-toast-in {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(animStyle);
  }

  const header = document.createElement("div");
  header.style.cssText = "display: flex !important; align-items: center !important; gap: 8px !important;";
  
  const icon = document.createElement("span");
  icon.textContent = "✓";
  icon.style.cssText = "font-size: 18px !important;";

  const text = document.createElement("span");
  text.textContent = message;

  header.appendChild(icon);
  header.appendChild(text);
  toast.appendChild(header);

  if (details) {
    const detailEl = document.createElement("div");
    detailEl.style.cssText = "font-size: 12px !important; opacity: 0.9 !important; margin-left: 26px !important;";
    detailEl.textContent = details;
    toast.appendChild(detailEl);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

/**
 * クリップボード翻訳の結果をオーバーレイで表示（未使用・ポップアップ表示に変更済み）
 */
export function showTranslationOverlay(translation: string): void {
  injectLoadingStyles();

  const existing = document.getElementById("translator-clipboard-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "translator-clipboard-overlay";
  overlay.className = "translator-clipboard-overlay";

  const title = document.createElement("div");
  title.className = "translator-clipboard-overlay-title";
  title.textContent = "クリップボードの翻訳結果";

  const body = document.createElement("div");
  body.className = "translator-clipboard-overlay-body";
  body.textContent = translation;

  const actions = document.createElement("div");
  actions.className = "translator-clipboard-overlay-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "translator-clipboard-overlay-btn translator-clipboard-overlay-btn-copy";
  copyBtn.textContent = "クリップボードにコピー";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(translation);
      copyBtn.textContent = "コピーしました";
      copyBtn.disabled = true;
      setTimeout(() => {
        copyBtn.textContent = "クリップボードにコピー";
        copyBtn.disabled = false;
      }, 1500);
    } catch {
      copyBtn.textContent = "コピーに失敗しました";
    }
  });

  const closeBtn = document.createElement("button");
  closeBtn.className = "translator-clipboard-overlay-btn translator-clipboard-overlay-btn-close";
  closeBtn.textContent = "閉じる";
  closeBtn.addEventListener("click", () => overlay.remove());

  actions.appendChild(copyBtn);
  actions.appendChild(closeBtn);

  overlay.appendChild(title);
  overlay.appendChild(body);
  overlay.appendChild(actions);

  const backdrop = document.createElement("div");
  backdrop.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:2147483646;";
  backdrop.addEventListener("click", () => {
    overlay.remove();
    backdrop.remove();
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(overlay);
}

/**
 * 翻訳中インジケーターを非表示
 * エラー表示の場合は削除しない
 */
export function hideLoadingIndicator(): void {
  const indicator = document.getElementById("translator-loading-indicator");
  if (indicator) {
    if (indicator.classList.contains("error")) {
      return;
    }
    indicator.remove();
  }
}

/**
 * 翻訳対象に翻訳中マーカーを追加
 */
// 翻訳中の要素を追跡（重複を防ぐため）
const translatingElements = new Set<HTMLElement>();

export function markTargetsAsTranslating(targets: TranslationTarget[]): void {
  for (const target of targets) {
    if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
      const parent = target.node.parentElement;
      if (parent && !translatingElements.has(parent)) {
        // 親要素が既に翻訳中の親要素の子要素の場合は、外側の親要素のみにマーカーを設定
        // これにより、入れ子になった親要素に重複してマーカーが設定されるのを防ぐ
        const hasTranslatingAncestor = parent.closest('[data-translating="true"]');
        if (!hasTranslatingAncestor) {
          parent.setAttribute("data-translating", "true");
          translatingElements.add(parent);
        }
      }
    } else if (target.type === "attr" && target.node instanceof HTMLElement) {
      const element = target.node;
      if (!translatingElements.has(element)) {
        // 属性の場合も同様に、既に翻訳中の親要素の子要素の場合はスキップ
        const hasTranslatingAncestor = element.closest('[data-translating="true"]');
        if (!hasTranslatingAncestor) {
          element.setAttribute("data-translating", "true");
          translatingElements.add(element);
        }
      }
    }
  }
}

/**
 * 翻訳対象の翻訳中マーカーを削除
 */
export function unmarkTargetsAsTranslating(targets: TranslationTarget[]): void {
  // 削除対象の要素を収集
  const elementsToUnmark = new Set<HTMLElement>();
  
  for (const target of targets) {
    if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
      const parent = target.node.parentElement;
      if (parent) {
        elementsToUnmark.add(parent);
      }
    } else if (target.type === "attr" && target.node instanceof HTMLElement) {
      elementsToUnmark.add(target.node);
    }
  }
  
  // 他の翻訳対象がまだ存在するかチェックしてから削除
  for (const element of elementsToUnmark) {
    // この要素に関連する翻訳対象がまだ存在するかチェック
    let hasOtherTranslatingTargets = false;
    
    // translationStateをチェックして、この要素に関連する翻訳対象がまだ翻訳中かどうかを確認
    // 簡易的な方法：data-translating属性を持つ子要素がまだ存在するかチェック
    const hasTranslatingChildren = element.querySelector('[data-translating="true"]');
    
    if (!hasTranslatingChildren && translatingElements.has(element)) {
      element.removeAttribute("data-translating");
      translatingElements.delete(element);
    }
  }
}

