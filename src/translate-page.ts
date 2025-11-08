// ====== ページ全体の翻訳 ======
import type { TranslationTarget } from "./types";
import { config, translationState, getCurrentLang, setCurrentLang, getIsTranslating, getObserver } from "./state";
import { getTargetKey } from "./utils";
import { collectTargets, filterNewTargets, saveOriginalTexts } from "./target-collector";
import { translateTargetsInBatches } from "./translation";
import { addOriginalTooltip } from "./tooltip";
import { showErrorMessage } from "./ui";
import { startObserver } from "./observer";

/**
 * ページ全体を翻訳
 */
export async function translatePage(targetLang: string = "ja"): Promise<void> {
  // 既に翻訳中の場合はスキップ（重複翻訳を防ぐ）
  if (getIsTranslating()) {
    console.log("[Translator] 翻訳処理が既に実行中です。スキップします。");
    return;
  }

  setCurrentLang(targetLang);

  // 1. 翻訳対象を収集
  const allTargets = collectTargets();
  const newTargets = filterNewTargets(allTargets);

  if (newTargets.length === 0) {
    showErrorMessage("翻訳対象が見つかりませんでした", "ページに翻訳可能なテキストがありません");
    return;
  }

  try {
    // 2. 原文を保存（念のため、再度フィルタリングして重複を防ぐ）
    const finalTargets = filterNewTargets(newTargets);
    if (finalTargets.length === 0) {
      console.log("[Translator] 保存前に再度フィルタリングした結果、翻訳対象が0件になりました。");
      return;
    }
    saveOriginalTexts(finalTargets);

    // 3. バッチ翻訳を実行
    await translateTargetsInBatches(finalTargets, targetLang);
    
    // ツールチップを追加（translateTargetsInBatches内で既に追加されているが、念のため）
    for (const target of finalTargets) {
      const key = getTargetKey(target);
      const state = translationState.get(key);
      if (state && state.current !== state.original) {
        addOriginalTooltip(target, state.original);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "不明なエラー";
    showErrorMessage("翻訳に失敗しました", errorMessage);
    throw error;
  }

  // 4. 動的コンテンツ監視を開始
  if (config.observe && !getObserver()) {
    startObserver();
  }
}

