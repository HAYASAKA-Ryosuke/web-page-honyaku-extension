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

