// ====== 翻訳対象の収集 ======
import type { TranslationTarget } from "./types";
import { config, translationState } from "./state";
import { isVisibleTextNode, getTargetKey } from "./utils";

/**
 * DOMから翻訳対象を収集
 */
export function collectTargets(root: HTMLElement = document.body): TranslationTarget[] {
  const targets: TranslationTarget[] = [];

  // テキストノードを収集
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return isVisibleTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue;

    // 句読点のみのテキストは除外
    if (!text || !/[^\s\u3000.,;:!?、。]/.test(text)) {
      continue;
    }

    targets.push({
      type: "text",
      node,
      get: () => node.nodeValue || "",
      set: (value: string) => {
        node.nodeValue = value;
      },
    });
  }

  // 属性を収集
  const selector = config.attrKeys.map((key) => `[${key}]`).join(",");
  const elements = root.querySelectorAll(selector);

  for (const element of Array.from(elements)) {
    const htmlElement = element as HTMLElement;
    
    // 原文表示ポップアップ内の要素は除外
    if (htmlElement.closest(".translator-original-display")) {
      continue;
    }
    
    for (const key of config.attrKeys) {
      const value = htmlElement.getAttribute(key);
      if (value && value.trim().length >= config.minTextLen) {
        targets.push({
          type: "attr",
          node: htmlElement,
          key,
          get: () => htmlElement.getAttribute(key) || "",
          set: (value: string) => htmlElement.setAttribute(key, value),
        });
      }
    }
  }

  return targets;
}

/**
 * 新しい翻訳対象のみをフィルタリング
 */
export function filterNewTargets(targets: TranslationTarget[]): TranslationTarget[] {
  return targets.filter((target) => {
    const key = getTargetKey(target);
    return !translationState.has(key);
  });
}

/**
 * 原文を保存
 */
export function saveOriginalTexts(targets: TranslationTarget[]): void {
  for (const target of targets) {
    const key = getTargetKey(target);
    const original = target.get() || "";
    translationState.set(key, {
      original,
      current: original,
    });
  }
}

