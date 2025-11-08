// ====== 初期化とメッセージハンドラー ======
import { state, initializeConfig, loadShowOriginalSetting } from "./state";
import { translatePage } from "./translate-page";
import { translateSelection } from "./translate-selection";
import { restoreOriginal } from "./restore";
import { locateTargetByKey } from "./node-locator";
import { addOriginalTooltip } from "./tooltip";

// バックグラウンドスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener(
  (
    msg: { type: string; targetLang?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success: boolean; message: string }) => void
  ) => {
    if (msg.type === "TRANSLATE_PAGE") {
      const targetLang = msg.targetLang || "ja";
      translatePage(targetLang)
        .then(() => {
          sendResponse({ success: true, message: "翻訳が完了しました" });
        })
        .catch((error: Error) => {
          console.error("翻訳エラー:", error);
          sendResponse({
            success: false,
            message: `翻訳エラー: ${error.message}`,
          });
        });
      return true; // 非同期レスポンスを許可
    }

    if (msg.type === "TRANSLATE_SELECTION") {
      const targetLang = msg.targetLang || "ja";
      translateSelection(targetLang)
        .then(() => {
          sendResponse({ success: true, message: "選択テキストの翻訳が完了しました" });
        })
        .catch((error: Error) => {
          console.error("翻訳エラー:", error);
          sendResponse({
            success: false,
            message: `翻訳エラー: ${error.message}`,
          });
        });
      return true; // 非同期レスポンスを許可
    }

    if (msg.type === "RESTORE_ORIGINAL") {
      restoreOriginal();
      sendResponse({ success: true, message: "原文に戻しました" });
      return true;
    }

    if (msg.type === "RELOAD_CONFIG") {
      // 設定を再読み込み
      loadShowOriginalSetting().then(() => {
        // 原文表示がOFFになった場合、既存のツールチップを削除
        if (!state.showOriginal) {
          const existingDisplays = document.querySelectorAll(".translator-original-display");
          existingDisplays.forEach((display) => display.remove());
          
          // すべてのイベントリスナーを削除（AbortControllerで管理）
          const elementsWithTooltip = document.querySelectorAll("[data-tooltip-handler-added]");
          elementsWithTooltip.forEach((element) => {
            const controller = state.tooltipControllers.get(element as HTMLElement);
            if (controller) {
              controller.abort();
              state.tooltipControllers.delete(element as HTMLElement);
            }
            element.removeAttribute("data-tooltip-handler-added");
          });
        } else {
          // 原文表示がONになった場合、既存の翻訳済み要素に対してツールチップを再追加
          for (const [key, translationState] of state.translationState.entries()) {
            if (translationState.current !== translationState.original) {
              const target = locateTargetByKey(key);
              if (target) {
                // 既存のツールチップハンドラーを削除（再追加のため）
                if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
                  const parent = target.node.parentElement;
                  if (parent) {
                    const controller = state.tooltipControllers.get(parent);
                    if (controller) {
                      controller.abort();
                      state.tooltipControllers.delete(parent);
                    }
                    parent.removeAttribute("data-tooltip-handler-added");
                  }
                } else if (target.type === "attr" && target.node instanceof HTMLElement) {
                  const element = target.node;
                  const controller = state.tooltipControllers.get(element);
                  if (controller) {
                    controller.abort();
                    state.tooltipControllers.delete(element);
                  }
                  element.removeAttribute("data-tooltip-handler-added");
                }
                // ツールチップを再追加
                addOriginalTooltip(target, translationState.original);
              }
            }
          }
        }
      });
      
      initializeConfig()
        .then(() => {
          sendResponse({ success: true, message: "設定を再読み込みしました" });
        })
        .catch((error: Error) => {
          console.error("設定の再読み込みエラー:", error);
          sendResponse({
            success: false,
            message: `設定の再読み込みエラー: ${error.message}`,
          });
        });
      return true;
    }

    return false;
  }
);
