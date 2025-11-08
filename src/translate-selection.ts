// ====== 選択テキストの翻訳 ======
import type { TranslationTarget } from "./types";
import { state } from "./state";
import { isVisibleTextNode, getTargetKey } from "./utils";
import { collectTargets, saveOriginalTexts } from "./target-collector";
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

