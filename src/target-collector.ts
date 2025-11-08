// ====== 翻訳対象の収集 ======
import type { TranslationTarget } from "./types";
import { state } from "./state";
import { isVisibleTextNode, getTargetKey } from "./utils";

/**
 * ブロックレベル要素を取得（p, div, h1-h6, li, article, section など）
 */
function getBlockLevelParent(element: HTMLElement): HTMLElement | null {
  const blockLevelTags = [
    "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "article", "section", "aside", "header", "footer",
    "main", "nav", "blockquote", "pre", "td", "th"
  ];
  
  let current: HTMLElement | null = element;
  while (current) {
    const tagName = current.tagName?.toLowerCase();
    if (tagName && blockLevelTags.includes(tagName)) {
      return current;
    }
    current = current.parentElement;
  }
  
  return null;
}

/**
 * 同じブロックレベル要素内のテキストノードをグループ化
 * これにより、<p><span>...</span><em>...</em><span>...</span></p>のような
 * 構造でも、1つの文として翻訳される
 */
function groupTextNodesByParent(root: HTMLElement): Map<HTMLElement, Text[]> {
  const groups = new Map<HTMLElement, Text[]>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return isVisibleTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.nodeValue;

    // 句読点のみのテキストは除外
    if (!text || !/[^\s\u3000.,;:!?、。]/.test(text)) {
      continue;
    }

    const directParent = node.parentElement;
    if (!directParent) {
      continue;
    }

    // ブロックレベル要素を取得（なければ直接の親要素を使用）
    const blockParent = getBlockLevelParent(directParent) || directParent;

    if (!groups.has(blockParent)) {
      groups.set(blockParent, []);
    }
    groups.get(blockParent)!.push(node);
  }

  return groups;
}

/**
 * DOMから翻訳対象を収集（親要素ごとにグループ化）
 */
export function collectTargets(root: HTMLElement = document.body): TranslationTarget[] {
  const targets: TranslationTarget[] = [];

  // 親要素ごとにテキストノードをグループ化
  const textNodeGroups = groupTextNodesByParent(root);

  // 各親要素ごとに、テキストノードを結合して翻訳対象を作成
  for (const [parent, textNodes] of textNodeGroups.entries()) {
    // 原文表示ポップアップ内の要素は除外
    if (parent.closest(".translator-original-display")) {
      continue;
    }

    // テキストノードが1つの場合は通常通り処理
    if (textNodes.length === 1) {
      const node = textNodes[0];
      targets.push({
        type: "text",
        node,
        get: () => node.nodeValue || "",
        set: (value: string) => {
          node.nodeValue = value;
        },
      });
    } else {
      // 複数のテキストノードがある場合は、結合して翻訳
      // 結合されたテキストを取得する関数
      const getCombinedText = (): string => {
        return textNodes.map(node => node.nodeValue || "").join("");
      };

      // 翻訳結果を各ノードに分配する関数
      // 1文字単位で改行される問題を防ぐため、翻訳結果は最初のノードにすべて割り当て、
      // 残りのノードは空文字列にする
      const setCombinedTranslation = (translated: string): void => {
        const originalText = getCombinedText();
        if (originalText.length === 0 || translated.length === 0) {
          return;
        }

        // 翻訳結果を最初のテキストノードにすべて割り当て
        if (textNodes.length > 0) {
          textNodes[0].nodeValue = translated;
        }
        
        // 残りのテキストノードは空文字列にする（DOM構造を保持するため）
        for (let i = 1; i < textNodes.length; i++) {
          textNodes[i].nodeValue = "";
        }
      };

      targets.push({
        type: "text",
        node: textNodes[0], // 最初のノードを代表として使用
        get: getCombinedText,
        set: setCombinedTranslation,
      });
    }
  }

  // 属性を収集
  const selector = state.config.attrKeys.map((key) => `[${key}]`).join(",");
  const elements = root.querySelectorAll(selector);

  for (const element of Array.from(elements)) {
    const htmlElement = element as HTMLElement;
    
    // 原文表示ポップアップ内の要素は除外
    if (htmlElement.closest(".translator-original-display")) {
      continue;
    }
    
    for (const key of state.config.attrKeys) {
      const value = htmlElement.getAttribute(key);
      if (value && value.trim().length >= state.config.minTextLen) {
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
    return !state.translationState.has(key);
  });
}

/**
 * 原文を保存
 */
export function saveOriginalTexts(targets: TranslationTarget[]): void {
  for (const target of targets) {
    const key = getTargetKey(target);
    const original = target.get() || "";
    state.translationState.set(key, {
      original,
      current: original,
    });
  }
}

