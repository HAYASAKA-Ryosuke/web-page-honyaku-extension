// ====== 選択テキストの翻訳 ======
import type { TranslationTarget } from "./types";
import { state } from "./state";
import { isVisibleTextNode, getTargetKey } from "./utils";
import { saveOriginalTexts } from "./target-collector";
import { translateTargetsInBatches } from "./translation";
import { addOriginalTooltip } from "./tooltip";
import { showErrorMessage } from "./ui";

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

  // 選択範囲内のテキストノードを収集
  const targets: TranslationTarget[] = [];
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!isVisibleTextNode(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      // 選択範囲と重なるかチェック
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);
      const intersects = range.intersectsNode(node);
      return intersects ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue;
    if (text && /[^\s\u3000.,;:!?、。]/.test(text)) {
      targets.push({
        type: "text",
        node,
        get: () => node.nodeValue || "",
        set: (value: string) => {
          node.nodeValue = value;
        },
      });
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

