// ====== 原文復元 ======
import { state } from "./state";
import { locateTargetByKey } from "./node-locator";

/**
 * 原文に戻す
 */
export function restoreOriginal(): void {
  // 原文表示要素を削除
  const originalDisplays = document.querySelectorAll(".translator-original-display");
  originalDisplays.forEach((el) => el.remove());
  
  for (const [key, translationState] of state.translationState.entries()) {
    const target = locateTargetByKey(key);
    if (target) {
      target.set(translationState.original);
      translationState.current = translationState.original;
      
      // 属性をクリーンアップ
      if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
        const parent = target.node.parentElement;
        if (parent) {
          const originalTitle = parent.getAttribute("data-original-title");
          if (originalTitle) {
            parent.setAttribute("title", originalTitle);
            parent.removeAttribute("data-original-title");
          } else {
            parent.removeAttribute("title");
          }
          parent.removeAttribute("data-translated");
          parent.removeAttribute("data-tooltip-handler-added");
        }
      } else if (target.type === "attr" && target.node instanceof HTMLElement) {
        const element = target.node;
        const originalTitle = element.getAttribute("data-original-title");
        if (originalTitle) {
          element.setAttribute("title", originalTitle);
          element.removeAttribute("data-original-title");
        } else {
          element.removeAttribute("title");
        }
        element.removeAttribute("data-translated");
        element.removeAttribute("data-tooltip-handler-added");
        
        // 属性のdata属性も削除
        for (const key of state.config.attrKeys) {
          element.removeAttribute(`data-original-${key}`);
        }
      }
    }
  }
}

