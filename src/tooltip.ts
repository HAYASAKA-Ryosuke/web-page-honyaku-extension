// ====== 原文表示（ツールチップ） ======
import type { TranslationTarget } from "./types";
import { state } from "./state";
import { getTargetKey } from "./utils";
import { injectTooltipStyles } from "./styles";

/**
 * 要素内のすべての翻訳済みテキストノードの原文を取得
 */
function getAllOriginalTexts(element: HTMLElement): string[] {
  const texts: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeId = state.nodeIdMap.get(node);
    if (nodeId) {
      const key = `text:${nodeId}`;
      const translationState = state.translationState.get(key);
      if (translationState && translationState.current !== translationState.original) {
        texts.push(translationState.original);
      }
    }
  }
  
  return texts;
}

/**
 * マウスオーバー時に原文を要素の上に表示
 */
export function addOriginalTooltip(target: TranslationTarget, original: string): void {
  // 原文表示がOFFの場合は何もしない
  if (!state.showOriginal) {
    return;
  }
  
  // スタイルを注入
  injectTooltipStyles();

  if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
    const parent = target.node.parentElement;
    if (parent && !parent.hasAttribute("data-tooltip-handler-added")) {
      // 既存のtitle属性を保存（元のtitleがあれば）
      if (!parent.hasAttribute("data-original-title")) {
        const existingTitle = parent.getAttribute("title");
        if (existingTitle) {
          parent.setAttribute("data-original-title", existingTitle);
        }
      }
      // 翻訳済みであることを示すマーカーを追加
      parent.setAttribute("data-translated", "true");
      parent.setAttribute("data-tooltip-handler-added", "true");
      
      // AbortControllerを作成してイベントリスナーを管理
      const controller = new AbortController();
      state.tooltipControllers.set(parent, controller);
      
      // マウスオーバー時に原文を表示
      parent.addEventListener("mouseenter", () => {
        // 既に固定表示されている場合は何もしない
        const existingPinned = parent.querySelector(".translator-original-display.pinned");
        if (existingPinned) {
          return;
        }
        
        // 既存の非固定の原文表示要素がある場合は何もしない（既に表示されている）
        const existingNonPinned = parent.querySelector(".translator-original-display:not(.pinned)");
        if (existingNonPinned) {
          return;
        }
        
        // 要素内のすべての原文を取得
        const allOriginals = getAllOriginalTexts(parent);
        if (allOriginals.length > 0) {
          // 要素の位置を取得して、上側か下側かを判定
          const rect = parent.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportTop = 0;
          const spaceAbove = rect.top - viewportTop;
          const spaceBelow = viewportHeight - rect.bottom;
          
          // 原文表示要素を作成
          const originalDisplay = document.createElement("div");
          originalDisplay.className = "translator-original-display";
          
          // ヘッダー部分を作成（「原文:」とピンアイコン）
          const header = document.createElement("div");
          header.className = "translator-original-header";
          header.textContent = "原文:";
          
          // ピン止めアイコンを作成
          const pinIcon = document.createElement("div");
          pinIcon.className = "translator-pin-icon";
          pinIcon.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z"/>
            </svg>
          `;
          
          // ピンアイコンをクリックで固定/解除
          pinIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            if (originalDisplay.classList.contains("pinned")) {
              originalDisplay.classList.remove("pinned");
              originalDisplay.remove();
            } else {
              originalDisplay.classList.add("pinned");
            }
          });
          
          header.appendChild(pinIcon);
          
          // コンテンツ部分を作成
          const content = document.createElement("div");
          content.className = "translator-original-content";
          content.textContent = allOriginals.join(" ");
          
          originalDisplay.appendChild(header);
          originalDisplay.appendChild(content);
          
          // 位置を設定（上側に十分なスペースがない場合は下側に表示）
          // 一時的にDOMに追加して高さを測定
          originalDisplay.style.visibility = "hidden";
          originalDisplay.style.position = "absolute";
          parent.appendChild(originalDisplay);
          const displayHeight = originalDisplay.offsetHeight;
          originalDisplay.remove();
          originalDisplay.style.visibility = "visible";
          
          // 上側に表示する場合に必要なスペース（マージン4px + ポップアップの高さ）
          const requiredSpaceAbove = displayHeight + 4;
          
          if (spaceAbove < requiredSpaceAbove && spaceBelow > spaceAbove) {
            originalDisplay.classList.add("position-bottom");
            // 下側に表示する場合でも、画面を超えないように最大高さを設定
            if (spaceBelow < displayHeight + 20) {
              originalDisplay.style.maxHeight = `${Math.max(spaceBelow - 20, 100)}px`;
              originalDisplay.style.overflowY = "auto";
            }
          } else {
            originalDisplay.classList.add("position-top");
            // 上側に表示する場合、画面を超えないように最大高さを設定
            if (spaceAbove < requiredSpaceAbove + 20) {
              originalDisplay.style.maxHeight = `${Math.max(spaceAbove - 24, 100)}px`;
              originalDisplay.style.overflowY = "auto";
            }
          }
        
          // DOMに追加する直前に再度チェック（多重生成を防ぐ）
          const existingBeforeInsert = parent.querySelector(".translator-original-display:not(.pinned)");
          if (existingBeforeInsert) {
            existingBeforeInsert.remove();
          }
          
          // 親要素の最初の子として挿入
          if (parent.firstChild) {
            parent.insertBefore(originalDisplay, parent.firstChild);
          } else {
            parent.appendChild(originalDisplay);
          }
          
          // originalDisplay内のイベントリスナーもAbortControllerで管理
          originalDisplay.addEventListener("mouseenter", (e) => {
            e.stopPropagation();
          }, { signal: controller.signal });
          
          originalDisplay.addEventListener("mouseleave", (e) => {
            e.stopPropagation();
            // 固定されていない場合のみ削除
            if (!originalDisplay.classList.contains("pinned")) {
              // マウスが原文表示要素内の他の要素に移動した場合は削除しない
              const relatedTarget = e.relatedTarget as Node | null;
              if (relatedTarget && originalDisplay.contains(relatedTarget)) {
                return;
              }
              // 少し待ってから削除（マージン部分を通過する時間を考慮）
              const timeoutId = setTimeout(() => {
                if (originalDisplay && !originalDisplay.classList.contains("pinned")) {
                  // 現在のマウス位置を取得
                  const mouseElement = document.elementFromPoint(
                    (e as MouseEvent).clientX,
                    (e as MouseEvent).clientY
                  );
                  
                  // マウスが原文表示要素内にある場合は削除しない
                  if (mouseElement && originalDisplay.contains(mouseElement)) {
                    return;
                  }
                  
                  originalDisplay.remove();
                }
              }, 100);
              
              // マウスが戻ってきた場合はタイマーをキャンセル
              const cancelTimeout = () => {
                clearTimeout(timeoutId);
                originalDisplay.removeEventListener("mouseenter", cancelTimeout);
              };
              originalDisplay.addEventListener("mouseenter", cancelTimeout, { signal: controller.signal });
            }
          }, { signal: controller.signal });
        }
      }, { signal: controller.signal });
      
      // マウスアウト時に原文表示を削除（固定されていない場合のみ、かつ原文表示要素の上にマウスがない場合）
      parent.addEventListener("mouseleave", (e) => {
        const originalDisplay = parent.querySelector(".translator-original-display:not(.pinned)");
        if (originalDisplay) {
          // マウスが原文表示要素に移動した場合は削除しない
          const relatedTarget = e.relatedTarget as Node | null;
          if (relatedTarget) {
            // 原文表示要素またはその子要素に移動した場合
            if (originalDisplay.contains(relatedTarget)) {
              return;
            }
            // 親要素内の他の要素に移動した場合（マージン部分を通過中など）
            if (parent.contains(relatedTarget)) {
              return;
            }
          }
          // 少し待ってから削除（マージン部分を通過する時間を考慮）
          const timeoutId = setTimeout(() => {
            if (originalDisplay && !originalDisplay.classList.contains("pinned")) {
              // 現在のマウス位置を取得
              const mouseEvent = e as MouseEvent;
              const mouseElement = document.elementFromPoint(
                mouseEvent.clientX,
                mouseEvent.clientY
              );
              
              // マウスが親要素または原文表示要素内にある場合は削除しない
              if (mouseElement && (parent.contains(mouseElement) || originalDisplay.contains(mouseElement))) {
                return;
              }
              
              originalDisplay.remove();
            }
          }, 150);
          
          // マウスが戻ってきた場合はタイマーをキャンセル
          const cancelTimeout = () => {
            clearTimeout(timeoutId);
            parent.removeEventListener("mouseenter", cancelTimeout);
            if (originalDisplay) {
              originalDisplay.removeEventListener("mouseenter", cancelTimeout);
            }
          };
          parent.addEventListener("mouseenter", cancelTimeout);
          originalDisplay.addEventListener("mouseenter", cancelTimeout);
        }
      }, { signal: controller.signal });
    }
  } else if (target.type === "attr" && target.node instanceof HTMLElement) {
    // 属性の場合は、要素に設定
    const element = target.node;
    const attrKey = target.key || "attr";
    
    if (!element.hasAttribute("data-original-title")) {
      const existingTitle = element.getAttribute("title");
      if (existingTitle) {
        element.setAttribute("data-original-title", existingTitle);
      }
    }
    element.setAttribute("data-translated", "true");
    
    // 属性の原文をdata属性に保存
    const key = getTargetKey(target);
    const translationState = state.translationState.get(key);
    if (translationState && translationState.current !== translationState.original) {
      element.setAttribute(`data-original-${attrKey}`, translationState.original);
    }
    
    // マウスオーバー時に原文を表示（既に追加されていない場合のみ）
    if (!element.hasAttribute("data-tooltip-handler-added")) {
      element.setAttribute("data-tooltip-handler-added", "true");
      
      // AbortControllerを作成してイベントリスナーを管理
      const controller = new AbortController();
      state.tooltipControllers.set(element, controller);
      
      element.addEventListener("mouseenter", () => {
        // 既に固定表示されている場合は何もしない
        const existingPinned = element.querySelector(".translator-original-display.pinned");
        if (existingPinned) {
          return;
        }
        
        // 既存の非固定の原文表示要素がある場合は何もしない（既に表示されている）
        const existingNonPinned = element.querySelector(".translator-original-display:not(.pinned)");
        if (existingNonPinned) {
          return;
        }
        
        // すべての属性の原文を取得
        const allOriginals: string[] = [];
        for (const key of state.config.attrKeys) {
          const originalText = element.getAttribute(`data-original-${key}`);
          if (originalText) {
            allOriginals.push(originalText);
          }
        }
        
        if (allOriginals.length > 0) {
          // 要素の位置を取得して、上側か下側かを判定
          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const spaceAbove = rect.top;
          const spaceBelow = viewportHeight - rect.bottom;
          
          // 原文表示要素を作成
          const originalDisplay = document.createElement("div");
          originalDisplay.className = "translator-original-display";
          
          // 位置を設定（上側に十分なスペースがない場合は下側に表示）
          if (spaceAbove < 150 && spaceBelow > spaceAbove) {
            originalDisplay.classList.add("position-bottom");
          } else {
            originalDisplay.classList.add("position-top");
          }
          
          // ヘッダー部分を作成（「原文:」とピンアイコン）
          const header = document.createElement("div");
          header.className = "translator-original-header";
          header.textContent = "原文:";
          
          // ピン止めアイコンを作成
          const pinIcon = document.createElement("div");
          pinIcon.className = "translator-pin-icon";
          pinIcon.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z"/>
            </svg>
          `;
          
          // ピンアイコンをクリックで固定/解除
          pinIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            if (originalDisplay.classList.contains("pinned")) {
              originalDisplay.classList.remove("pinned");
              originalDisplay.remove();
            } else {
              originalDisplay.classList.add("pinned");
            }
          });
          
          header.appendChild(pinIcon);
          
          // コンテンツ部分を作成
          const content = document.createElement("div");
          content.className = "translator-original-content";
          content.textContent = allOriginals.join(" / ");
          
          originalDisplay.appendChild(header);
          originalDisplay.appendChild(content);
          
          // DOMに追加する直前に再度チェック（多重生成を防ぐ）
          const existingBeforeInsert = element.querySelector(".translator-original-display:not(.pinned)");
          if (existingBeforeInsert) {
            existingBeforeInsert.remove();
          }
          
          // 要素の最初の子として挿入
          if (element.firstChild) {
            element.insertBefore(originalDisplay, element.firstChild);
          } else {
            element.appendChild(originalDisplay);
          }
          
          // originalDisplay内のイベントリスナーもAbortControllerで管理
          originalDisplay.addEventListener("mouseenter", (e) => {
            e.stopPropagation();
          }, { signal: controller.signal });
          
          originalDisplay.addEventListener("mouseleave", (e) => {
            e.stopPropagation();
            // 固定されていない場合のみ削除
            if (!originalDisplay.classList.contains("pinned")) {
              // マウスが原文表示要素内の他の要素に移動した場合は削除しない
              const relatedTarget = e.relatedTarget as Node | null;
              if (relatedTarget && originalDisplay.contains(relatedTarget)) {
                return;
              }
              // 少し待ってから削除（マージン部分を通過する時間を考慮）
              const timeoutId = setTimeout(() => {
                if (originalDisplay && !originalDisplay.classList.contains("pinned")) {
                  // 現在のマウス位置を取得
                  const mouseElement = document.elementFromPoint(
                    (e as MouseEvent).clientX,
                    (e as MouseEvent).clientY
                  );
                  
                  // マウスが原文表示要素内にある場合は削除しない
                  if (mouseElement && originalDisplay.contains(mouseElement)) {
                    return;
                  }
                  
                  originalDisplay.remove();
                }
              }, 100);
              
              // マウスが戻ってきた場合はタイマーをキャンセル
              const cancelTimeout = () => {
                clearTimeout(timeoutId);
                originalDisplay.removeEventListener("mouseenter", cancelTimeout);
              };
              originalDisplay.addEventListener("mouseenter", cancelTimeout, { signal: controller.signal });
            }
          }, { signal: controller.signal });
        }
      }, { signal: controller.signal });
      
      // マウスアウト時に原文表示を削除（固定されていない場合のみ、かつ原文表示要素の上にマウスがない場合）
      element.addEventListener("mouseleave", (e) => {
        const originalDisplay = element.querySelector(".translator-original-display:not(.pinned)");
        if (originalDisplay) {
          // マウスが原文表示要素に移動した場合は削除しない
          const relatedTarget = e.relatedTarget as Node | null;
          if (relatedTarget) {
            // 原文表示要素またはその子要素に移動した場合
            if (originalDisplay.contains(relatedTarget)) {
              return;
            }
            // 親要素内の他の要素に移動した場合（マージン部分を通過中など）
            if (element.contains(relatedTarget)) {
              return;
            }
          }
          originalDisplay.remove();
        }
      }, { signal: controller.signal });
    }
  }
}

