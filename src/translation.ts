// ====== 翻訳処理 ======
import type { TranslationTarget } from "./types";
import { state, getIsTranslating, setIsTranslating, getObserver } from "./state";
import { getTargetKey } from "./utils";
import { showLoadingIndicator, hideLoadingIndicator, showErrorMessage, markTargetsAsTranslating, unmarkTargetsAsTranslating } from "./ui";
import { addOriginalTooltip } from "./tooltip";
import { disconnectObserver, startObserver } from "./observer";

/**
 * バッチ単位で翻訳を実行
 */
export async function translateTargetsInBatches(
  targets: TranslationTarget[],
  targetLang: string
): Promise<void> {
  // 既に翻訳中の場合はスキップ
  if (getIsTranslating()) {
    return;
  }
  
  setIsTranslating(true);
  
  // 翻訳処理中はObserverを一時停止
  const wasObserving = getObserver() !== null;
  if (wasObserving) {
    disconnectObserver();
  }
  
  try {
    // バッチに分割
    const batches: TranslationTarget[][] = [];
    for (let i = 0; i < targets.length; i += state.config.maxBatch) {
      batches.push(targets.slice(i, i + state.config.maxBatch));
    }

    // 翻訳中マーカーを追加
    markTargetsAsTranslating(targets);
    
    // 翻訳中インジケーターを表示
    showLoadingIndicator(batches.length, 0);

    try {
    // 各バッチを翻訳
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // 進捗を更新
      showLoadingIndicator(batches.length, batchIndex + 1);
      
      const texts = batch.map((target) => target.get() || "");

      // 空のバッチはスキップ
      if (!texts.some((text) => text.trim().length >= state.config.minTextLen)) {
        continue;
      }

      try {
        const translations = await state.config.provider.translate(texts, targetLang);

        if (!Array.isArray(translations) || translations.length !== texts.length) {
          console.warn("翻訳プロバイダーが予期しない結果を返しました");
          continue;
        }

        // 翻訳結果を適用
        for (let i = 0; i < batch.length; i++) {
          const target = batch[i];
          const translation = translations[i];

          if (typeof translation === "string" && translation.trim() !== "") {
            target.set(translation);
            const key = getTargetKey(target);
            const translationState = state.translationState.get(key);
            if (translationState) {
              translationState.current = translation;
              // 原文をtitle属性に設定（ホバーで表示）
              addOriginalTooltip(target, translationState.original);
            }
          }
        }
      } catch (error) {
        console.error("翻訳エラー:", error);
        const errorMessage = error instanceof Error ? error.message : "不明なエラー";
        
        // 最初のエラー時のみユーザーに表示
        if (batchIndex === 0) {
          let userMessage = "翻訳中にエラーが発生しました";
          let details = errorMessage;
          
          // APIキー未設定の場合は特別なメッセージ
          if (errorMessage.includes("APIキーが設定されていません") || errorMessage.includes("Claude APIキー")) {
            userMessage = "APIキーが設定されていません";
            details = "拡張機能のポップアップからAPIキーを設定してください";
          } else if (errorMessage.includes("401") || errorMessage.includes("認証")) {
            userMessage = "APIキーが無効です";
            details = "拡張機能のポップアップでAPIキーを確認してください";
          } else if (errorMessage.includes("429") || errorMessage.includes("レート制限")) {
            userMessage = "APIのレート制限に達しました";
            details = "しばらく待ってから再度お試しください";
          }
          
          showErrorMessage(userMessage, details);
        }
        // エラーが発生しても次のバッチを続行
      }
    }
    } finally {
      // 翻訳中マーカーを削除
      unmarkTargetsAsTranslating(targets);
      // 翻訳中インジケーターを非表示
      hideLoadingIndicator();
    }
  } finally {
    // 翻訳処理完了
    setIsTranslating(false);
    
    // Observerを再開（元々動いていた場合）
    if (wasObserving && state.config.observe) {
      startObserver();
    }
  }
}

