// ====== 動的コンテンツ監視 ======
import type { TranslationTarget } from "./types";
import { state, getCurrentLang, getIsTranslating, getObserver, setObserver } from "./state";
import { isVisibleTextNode, getTargetKey } from "./utils";
import { collectTargets, filterNewTargets, saveOriginalTexts } from "./target-collector";
import { translateTargetsInBatches } from "./translation";
import { addOriginalTooltip } from "./tooltip";

/**
 * 動的コンテンツの監視を開始
 */
export function startObserver(): void {
  if (getObserver()) {
    return; // 既に監視中
  }

  const observer = new MutationObserver(async (mutations: MutationRecord[]) => {
    // 翻訳処理中は何もしない
    if (getIsTranslating()) {
      return;
    }
    
    const newTargets: TranslationTarget[] = [];

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        // 追加されたノードを処理
        for (const node of Array.from(mutation.addedNodes)) {
          // 原文表示ポップアップ内のノードは除外
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.closest(".translator-original-display") || element.classList.contains("translator-original-display")) {
              continue;
            }
            newTargets.push(...collectTargets(element));
          } else if (node.nodeType === Node.TEXT_NODE) {
            // 原文表示ポップアップ内のテキストノードは除外
            const parent = node.parentElement;
            if (parent && (parent.closest(".translator-original-display") || parent.classList.contains("translator-original-display"))) {
              continue;
            }
            
            if (isVisibleTextNode(node)) {
              const text = node.nodeValue;
              if (text && /[^\s\u3000.,;:!?、。]/.test(text)) {
                newTargets.push({
                  type: "text",
                  node,
                  get: () => node.nodeValue || "",
                  set: (value: string) => {
                    node.nodeValue = value;
                  },
                });
              }
            }
          }
        }
      } else if (
        mutation.type === "attributes" &&
        mutation.attributeName &&
        state.config.attrKeys.includes(mutation.attributeName)
      ) {
        // 属性変更を処理
        const element = mutation.target as HTMLElement;
        
        // 原文表示ポップアップ内の要素は除外
        if (element.closest(".translator-original-display") || element.classList.contains("translator-original-display")) {
          continue;
        }
        
        const value = element.getAttribute(mutation.attributeName!);
        if (value && value.trim().length >= state.config.minTextLen) {
          newTargets.push({
            type: "attr",
            node: element,
            key: mutation.attributeName,
            get: () => element.getAttribute(mutation.attributeName!) || "",
            set: (value: string) => element.setAttribute(mutation.attributeName!, value),
          });
        }
      }
    }

    // 新しい翻訳対象を翻訳
    const freshTargets = filterNewTargets(newTargets);
    if (freshTargets.length > 0 && getCurrentLang()) {
      saveOriginalTexts(freshTargets);
      const currentLang = getCurrentLang();
      if (currentLang) {
        await translateTargetsInBatches(freshTargets, currentLang);
      }
      // ツールチップを追加
      for (const target of freshTargets) {
        const key = getTargetKey(target);
        const translationState = state.translationState.get(key);
        if (translationState && translationState.current !== translationState.original) {
          addOriginalTooltip(target, translationState.original);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
    attributes: true,
    attributeFilter: state.config.attrKeys,
  });
  
  setObserver(observer);
}

/**
 * 監視を停止
 */
export function disconnectObserver(): void {
  const observer = getObserver();
  if (observer) {
    observer.disconnect();
    setObserver(null);
  }
}

