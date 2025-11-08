// ====== 型定義 ======
interface TranslationProvider {
  translate(texts: string[], targetLang: string): Promise<string[]>;
}

interface TranslationTarget {
  readonly type: "text" | "attr";
  readonly node: Node | HTMLElement;
  readonly key?: string;
  get(): string | null;
  set(value: string): void;
}

interface TranslationState {
  original: string;
  current: string;
}

interface TranslatorConfig {
  provider: TranslationProvider;
  maxBatch: number;
  observe: boolean;
  minTextLen: number;
  attrKeys: string[];
}

// ====== モジュールスコープの状態 ======
// デフォルト設定（後でAPIキーを読み込んで更新）
let config: TranslatorConfig = {
  provider: createDummyProvider(),
  maxBatch: 10, // Claude APIはレート制限があるため、バッチサイズを小さく
  observe: true,
  minTextLen: 1,
  attrKeys: ["alt", "title", "aria-label"],
};

// 設定を初期化
// 注意: APIキーはコンテンツスクリプトでは読み込まない（セキュリティのため）
// APIキーはバックグラウンドスクリプトでのみ使用される
async function initializeConfig() {
  // バックグラウンドスクリプト経由でAPIを呼び出すプロバイダーを使用
  // APIキーの有無はバックグラウンドスクリプト側でチェックされる
  config.provider = createClaudeProvider();
  console.log("[Translator] Claude APIプロバイダーを初期化しました（バックグラウンド経由）");
}

// 初期化を実行
initializeConfig();

const translationState = new Map<string, TranslationState>();
const nodeIdMap = new WeakMap<Node | HTMLElement, string>();

// イベントリスナーの管理用（AbortController）
const tooltipControllers = new WeakMap<HTMLElement, AbortController>();

// 原文表示の設定（デフォルトはtrue）
let showOriginal = true;

// 原文表示の設定を読み込む
async function loadShowOriginalSetting(): Promise<void> {
  const result = await chrome.storage.local.get(["showOriginal"]);
  showOriginal = result.showOriginal !== false; // デフォルトはtrue
}

// 初期化時に設定を読み込む
loadShowOriginalSetting();
let currentLang: string | null = null;
let observer: MutationObserver | null = null;
let isTranslating = false; // 翻訳処理中フラグ

// ====== ユーティリティ関数 ======

/**
 * テキストノードが可視かどうかを判定
 */
function isVisibleTextNode(node: Node): boolean {
  if (node.nodeType !== Node.TEXT_NODE) {
    return false;
  }

    const text = node.nodeValue?.trim();
  if (!text || text.length < config.minTextLen) {
    return false;
  }

  const parent = node.parentElement;
  if (!parent) {
    return false;
  }

  // 非表示要素を除外
  const style = window.getComputedStyle(parent);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  // aria-hiddenを尊重
  if (parent.closest("[aria-hidden='true']")) {
    return false;
  }

  // 原文表示ポップアップを除外
  if (parent.closest(".translator-original-display")) {
    return false;
  }

  // 画面外の要素を除外（fixedは例外）
  if (!parent.offsetParent && style.position !== "fixed") {
    return false;
  }

  // script/style等を除外
  const tagName = parent.tagName?.toLowerCase();
  const excludedTags = ["script", "style", "noscript", "meta", "link"];
  if (tagName && excludedTags.includes(tagName)) {
    return false;
  }

    return true;
  }

/**
 * ノードの一意IDを取得（なければ生成）
 */
function getNodeId(node: Node | HTMLElement): string {
  let id = nodeIdMap.get(node);
  if (!id) {
    id = `n${Math.random().toString(36).slice(2)}${Date.now()}`;
    nodeIdMap.set(node, id);
  }
  return id;
}

/**
 * 翻訳対象の一意キーを生成
 */
function getTargetKey(target: TranslationTarget): string {
  const nodeId = getNodeId(target.node);
  if (target.type === "attr" && target.key) {
    return `attr:${target.key}:${nodeId}`;
  }
  return `text:${nodeId}`;
}

// ====== 翻訳対象の収集 ======

/**
 * DOMから翻訳対象を収集
 */
function collectTargets(root: HTMLElement = document.body): TranslationTarget[] {
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
function filterNewTargets(targets: TranslationTarget[]): TranslationTarget[] {
  return targets.filter((target) => {
    const key = getTargetKey(target);
    return !translationState.has(key);
  });
}

/**
 * 原文を保存
 */
function saveOriginalTexts(targets: TranslationTarget[]): void {
  for (const target of targets) {
    const key = getTargetKey(target);
    const original = target.get() || "";
    translationState.set(key, {
      original,
      current: original,
    });
  }
}

// ====== 翻訳処理 ======

/**
 * 翻訳中インジケーターを表示
 */
function showLoadingIndicator(totalBatches: number, currentBatch: number): void {
  injectLoadingStyles();
  
  let indicator = document.getElementById("translator-loading-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "translator-loading-indicator";
    indicator.className = "translator-loading-indicator";
    document.body.appendChild(indicator);
  }
  
  // エラー状態をリセット
  indicator.classList.remove("error", "warning");
  
  const spinner = document.createElement("div");
  spinner.className = "translator-loading-spinner";
  
  const text = document.createElement("span");
  if (totalBatches > 1) {
    text.textContent = `翻訳中... (${currentBatch}/${totalBatches})`;
  } else {
    text.textContent = "翻訳中...";
  }
  
  indicator.innerHTML = "";
  indicator.appendChild(spinner);
  indicator.appendChild(text);
}

/**
 * エラーメッセージを表示
 */
function showErrorMessage(message: string, details?: string): void {
  injectLoadingStyles();
  
  let indicator = document.getElementById("translator-loading-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "translator-loading-indicator";
    indicator.className = "translator-loading-indicator error";
    document.body.appendChild(indicator);
  } else {
    indicator.className = "translator-loading-indicator error";
  }
  
  const icon = document.createElement("span");
  icon.textContent = "⚠️";
  icon.style.fontSize = "18px";
  
  const text = document.createElement("span");
  text.textContent = message;
  
  indicator.innerHTML = "";
  indicator.appendChild(icon);
  indicator.appendChild(text);
  
  if (details) {
    const detailEl = document.createElement("div");
    detailEl.className = "translator-error-message";
    detailEl.textContent = details;
    indicator.appendChild(detailEl);
  }
  
  // 3秒後に自動的に非表示
  setTimeout(() => {
    if (indicator && indicator.parentNode) {
      indicator.remove();
    }
  }, 3000);
}

/**
 * 翻訳中インジケーターを非表示
 * エラー表示の場合は削除しない
 */
function hideLoadingIndicator(): void {
  const indicator = document.getElementById("translator-loading-indicator");
  if (indicator) {
    if (indicator.classList.contains("error")) {
      return;
    }
    indicator.remove();
  }
}

/**
 * 翻訳対象に翻訳中マーカーを追加
 */
function markTargetsAsTranslating(targets: TranslationTarget[]): void {
  for (const target of targets) {
    if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
      const parent = target.node.parentElement;
      if (parent) {
        parent.setAttribute("data-translating", "true");
      }
    } else if (target.type === "attr" && target.node instanceof HTMLElement) {
      target.node.setAttribute("data-translating", "true");
    }
  }
}

/**
 * 翻訳対象の翻訳中マーカーを削除
 */
function unmarkTargetsAsTranslating(targets: TranslationTarget[]): void {
  for (const target of targets) {
    if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
      const parent = target.node.parentElement;
      if (parent) {
        parent.removeAttribute("data-translating");
      }
    } else if (target.type === "attr" && target.node instanceof HTMLElement) {
      target.node.removeAttribute("data-translating");
    }
  }
}

/**
 * バッチ単位で翻訳を実行
 */
async function translateTargetsInBatches(
  targets: TranslationTarget[],
  targetLang: string
): Promise<void> {
  // 既に翻訳中の場合はスキップ
  if (isTranslating) {
    return;
  }
  
  isTranslating = true;
  
  // 翻訳処理中はObserverを一時停止
  const wasObserving = observer !== null;
  if (wasObserving) {
    disconnectObserver();
  }
  
  try {
    // バッチに分割
    const batches: TranslationTarget[][] = [];
    for (let i = 0; i < targets.length; i += config.maxBatch) {
      batches.push(targets.slice(i, i + config.maxBatch));
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
      if (!texts.some((text) => text.trim().length >= config.minTextLen)) {
        continue;
      }

      try {
        const translations = await config.provider.translate(texts, targetLang);

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
            const state = translationState.get(key);
            if (state) {
              state.current = translation;
              // 原文をtitle属性に設定（ホバーで表示）
              addOriginalTooltip(target, state.original);
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
    isTranslating = false;
    
    // Observerを再開（元々動いていた場合）
    if (wasObserving && config.observe) {
      startObserver();
    }
  }
}

// 翻訳中表示用のスタイルを追加
function injectLoadingStyles(): void {
  if (document.getElementById("translator-loading-styles")) {
    return; // 既に追加済み
  }

  const style = document.createElement("style");
  style.id = "translator-loading-styles";
  style.textContent = `
    .translator-loading-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4a90e2;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 2147483647;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 400px;
    }
    .translator-loading-indicator.error {
      background: #ff4444;
    }
    .translator-loading-indicator.warning {
      background: #ff9800;
    }
    .translator-error-message {
      margin-top: 8px;
      font-size: 12px;
      opacity: 0.9;
      line-height: 1.4;
    }
    .translator-loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: translator-spin 0.8s linear infinite;
    }
    @keyframes translator-spin {
      to { transform: rotate(360deg); }
    }
    [data-translating="true"] {
      position: relative;
      opacity: 0.6;
    }
    [data-translating="true"]::after {
      content: "翻訳中...";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(74, 144, 226, 0.1);
      color: #4a90e2;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 1px dashed #4a90e2;
      border-radius: 4px;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

// 原文表示用のスタイルを追加
function injectTooltipStyles(): void {
  if (document.getElementById("translator-tooltip-styles")) {
    return; // 既に追加済み
  }

  const style = document.createElement("style");
  style.id = "translator-tooltip-styles";
  style.textContent = `
    .translator-original-display {
      position: absolute;
      left: 0;
      right: 0;
      background: #ffffff;
      color: #333;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.6;
      word-wrap: break-word;
      white-space: pre-wrap;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      border: 1px solid #e0e0e0;
      max-height: calc(100vh - 40px);
      top: auto;
      bottom: auto;
    }
    .translator-original-display.position-top {
      bottom: 100%;
      margin-bottom: 4px;
    }
    .translator-original-display.position-top::after {
      content: "";
      position: absolute;
      bottom: -8px;
      left: 20px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #ffffff;
    }
    .translator-original-display.position-top::before {
      content: "";
      position: absolute;
      bottom: -9px;
      left: 20px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #e0e0e0;
    }
    .translator-original-display.position-bottom {
      top: 100%;
      margin-top: 4px;
    }
    .translator-original-display.position-bottom::after {
      content: "";
      position: absolute;
      top: -8px;
      left: 20px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid #ffffff;
    }
    .translator-original-display.position-bottom::before {
      content: "";
      position: absolute;
      top: -9px;
      left: 20px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid #e0e0e0;
    }
    .translator-original-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      font-weight: bold;
      color: #4a90e2;
      font-size: 12px;
    }
    .translator-original-display.pinned .translator-original-header {
      color: #ff6b6b;
    }
    .translator-original-content {
      color: #333;
      font-size: 14px;
    }
    .translator-original-display.pinned {
      background: #fff5f5;
      border-color: #ffcccc;
    }
    .translator-original-display.pinned.position-top::after {
      border-top-color: #fff5f5;
    }
    .translator-original-display.pinned.position-top::before {
      border-top-color: #ffcccc;
    }
    .translator-original-display.pinned.position-bottom::after {
      border-bottom-color: #fff5f5;
    }
    .translator-original-display.pinned.position-bottom::before {
      border-bottom-color: #ffcccc;
    }
    .translator-pin-icon {
      display: inline-flex;
      align-items: center;
      width: 16px;
      height: 16px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: auto;
      flex-shrink: 0;
    }
    .translator-original-display:hover .translator-pin-icon {
      opacity: 1;
    }
    .translator-original-display.pinned .translator-pin-icon {
      opacity: 1;
    }
    .translator-pin-icon svg {
      width: 100%;
      height: 100%;
      fill: #666;
    }
    .translator-pin-icon:hover svg {
      fill: #4a90e2;
    }
    .translator-original-display.pinned .translator-pin-icon svg {
      fill: #ff6b6b;
    }
    .translator-original-display.pinned .translator-pin-icon:hover svg {
      fill: #ff4444;
    }
    [data-translated="true"] {
      position: relative;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 要素内のすべての翻訳済みテキストノードの原文を取得
 */
function getAllOriginalTexts(element: HTMLElement): string[] {
  const texts: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeId = nodeIdMap.get(node);
    if (nodeId) {
      const key = `text:${nodeId}`;
      const state = translationState.get(key);
      if (state && state.current !== state.original) {
        texts.push(state.original);
      }
    }
  }
  
  return texts;
}

/**
 * マウスオーバー時に原文を要素の上に表示
 */
function addOriginalTooltip(target: TranslationTarget, original: string): void {
  // 原文表示がOFFの場合は何もしない
  if (!showOriginal) {
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
      tooltipControllers.set(parent, controller);
      
      // マウスオーバー時に原文を表示
      parent.addEventListener("mouseenter", () => {
        // 既に固定表示されている場合は何もしない
        const existingPinned = parent.querySelector(".translator-original-display.pinned");
        if (existingPinned) {
          return;
        }
        
        // 既存の非固定の原文表示要素があれば削除（固定されたものは除外）
        const existingNonPinned = parent.querySelector(".translator-original-display:not(.pinned)");
        if (existingNonPinned) {
          existingNonPinned.remove();
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
              // マウスが親要素またはその子要素に移動した場合は削除しない
              const relatedTarget = e.relatedTarget as Node | null;
              if (relatedTarget) {
                // 親要素内の他の要素に移動した場合（マージン部分を通過中など）
                if (parent.contains(relatedTarget)) {
                  return;
                }
                // 原文表示要素内の他の要素に移動した場合
                if (originalDisplay.contains(relatedTarget)) {
                  return;
                }
              }
              // 少し待ってから削除（マージン部分を通過する時間を考慮）
              const timeoutId = setTimeout(() => {
                if (originalDisplay && !originalDisplay.classList.contains("pinned")) {
                  // 現在のマウス位置を取得
                  const mouseElement = document.elementFromPoint(
                    (e as MouseEvent).clientX,
                    (e as MouseEvent).clientY
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
    const state = translationState.get(key);
    if (state && state.current !== state.original) {
      element.setAttribute(`data-original-${attrKey}`, state.original);
    }
    
    // マウスオーバー時に原文を表示（既に追加されていない場合のみ）
    if (!element.hasAttribute("data-tooltip-handler-added")) {
      element.setAttribute("data-tooltip-handler-added", "true");
      
      // AbortControllerを作成してイベントリスナーを管理
      const controller = new AbortController();
      tooltipControllers.set(element, controller);
      
      element.addEventListener("mouseenter", () => {
        // 既に固定表示されている場合は何もしない
        const existingPinned = element.querySelector(".translator-original-display.pinned");
        if (existingPinned) {
          return;
        }
        
        // 既存の非固定の原文表示要素があれば削除（固定されたものは除外）
        const existingNonPinned = element.querySelector(".translator-original-display:not(.pinned)");
        if (existingNonPinned) {
          existingNonPinned.remove();
        }
        
        // すべての属性の原文を取得
        const allOriginals: string[] = [];
        for (const key of config.attrKeys) {
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
              // マウスが親要素に移動した場合は削除しない（マージン部分を通過中）
              const relatedTarget = e.relatedTarget as Node | null;
              if (relatedTarget && element.contains(relatedTarget)) {
                return;
              }
              originalDisplay.remove();
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

/**
 * 選択されたテキストを翻訳
 */
async function translateSelection(targetLang: string = "ja"): Promise<void> {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    showErrorMessage("テキストが選択されていません", "翻訳したいテキストを選択してください");
    return;
  }

  const range = selection.getRangeAt(0);
  const selectedText = range.toString().trim();

  if (!selectedText || selectedText.length < config.minTextLen) {
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
    const state = translationState.get(key);
    if (state && state.current !== state.original) {
      addOriginalTooltip(target, state.original);
    }
  }
}

/**
 * ページ全体を翻訳
 */
async function translatePage(targetLang: string = "ja"): Promise<void> {
  currentLang = targetLang;

  // 1. 翻訳対象を収集
  const allTargets = collectTargets();
  const newTargets = filterNewTargets(allTargets);

  if (newTargets.length === 0) {
    showErrorMessage("翻訳対象が見つかりませんでした", "ページに翻訳可能なテキストがありません");
    return;
  }

  try {
    // 2. 原文を保存
    saveOriginalTexts(newTargets);

    // 3. バッチ翻訳を実行
    await translateTargetsInBatches(newTargets, targetLang);
    
    // ツールチップを追加（translateTargetsInBatches内で既に追加されているが、念のため）
    for (const target of newTargets) {
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
  if (config.observe && !observer) {
    startObserver();
  }
}

/**
 * 原文に戻す
 */
function restoreOriginal(): void {
  // 原文表示要素を削除
  const originalDisplays = document.querySelectorAll(".translator-original-display");
  originalDisplays.forEach((el) => el.remove());
  
  for (const [key, state] of translationState.entries()) {
    const target = locateTargetByKey(key);
    if (target) {
      target.set(state.original);
      state.current = state.original;
      
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
        for (const key of config.attrKeys) {
          element.removeAttribute(`data-original-${key}`);
        }
      }
    }
  }
}

// ====== 動的コンテンツ監視 ======

/**
 * 動的コンテンツの監視を開始
 */
function startObserver(): void {
  observer = new MutationObserver(async (mutations: MutationRecord[]) => {
    // 翻訳処理中は何もしない
    if (isTranslating) {
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
        config.attrKeys.includes(mutation.attributeName)
      ) {
        // 属性変更を処理
        const element = mutation.target as HTMLElement;
        
        // 原文表示ポップアップ内の要素は除外
        if (element.closest(".translator-original-display") || element.classList.contains("translator-original-display")) {
          continue;
        }
        
        const value = element.getAttribute(mutation.attributeName!);
        if (value && value.trim().length >= config.minTextLen) {
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
    if (freshTargets.length > 0 && currentLang) {
      saveOriginalTexts(freshTargets);
      await translateTargetsInBatches(freshTargets, currentLang);
      // ツールチップを追加
      for (const target of freshTargets) {
        const key = getTargetKey(target);
        const state = translationState.get(key);
        if (state && state.current !== state.original) {
          addOriginalTooltip(target, state.original);
        }
      }
    }
  });

  observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: true,
    attributeFilter: config.attrKeys,
  });
}

/**
 * 監視を停止
 */
function disconnectObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// ====== ノード逆引き ======

/**
 * キーから翻訳対象を逆引き
 */
function locateTargetByKey(key: string): TranslationTarget | null {
  const parts = key.split(":");
  if (parts.length < 2) {
    return null;
  }

  const type = parts[0];
    const isAttr = type === "attr";

  if (isAttr && parts.length < 3) {
    return null;
  }

  const nodeId = isAttr ? parts[2] : parts[1];
  const attrKey = isAttr ? parts[1] : undefined;

  // 全ノードを走査してIDを探す（簡易実装）
  const allElements = document.querySelectorAll("*");
  for (const element of Array.from(allElements)) {
    const htmlElement = element as HTMLElement;
    const id = nodeIdMap.get(htmlElement);

    if (id === nodeId) {
      if (isAttr && attrKey) {
        return {
          type: "attr",
          node: htmlElement,
          key: attrKey,
          get: () => htmlElement.getAttribute(attrKey) || "",
          set: (value: string) => htmlElement.setAttribute(attrKey, value),
        };
        } else {
        // テキストノードを探す
        for (const child of Array.from(htmlElement.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const childId = nodeIdMap.get(child);
            if (childId === nodeId) {
              return {
                type: "text",
                node: child,
                get: () => child.nodeValue || "",
                set: (value: string) => {
                  child.nodeValue = value;
                },
              };
            }
          }
        }
      }
    }

    // 子ノードも確認
    for (const child of Array.from(htmlElement.childNodes)) {
      const childId = nodeIdMap.get(child);
      if (childId === nodeId) {
        if (isAttr && attrKey) {
          return {
            type: "attr",
            node: htmlElement,
            key: attrKey,
            get: () => htmlElement.getAttribute(attrKey) || "",
            set: (value: string) => htmlElement.setAttribute(attrKey, value),
          };
        } else if (child.nodeType === Node.TEXT_NODE) {
          return {
            type: "text",
            node: child,
            get: () => child.nodeValue || "",
            set: (value: string) => {
              child.nodeValue = value;
            },
          };
        }
      }
    }
  }

  return null;
}

// ====== 翻訳プロバイダー ======

/**
 * LibreTranslate プロバイダー
 */
function createLibreTranslateProvider(config: {
  endpoint: string;
  apiKey?: string | null;
  source?: string;
}): TranslationProvider {
  return {
    async translate(texts: string[], target: string): Promise<string[]> {
      const body = {
        q: texts,
        source: config.source || "auto",
        target,
        format: "text",
        api_key: config.apiKey || undefined,
      };

      const response = await fetch(`${config.endpoint.replace(/\/$/, "")}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`翻訳APIエラー: ${response.status}`);
      }

      const data = await response.json();

      // レスポンス形式に応じて処理
      if (Array.isArray(data)) {
        return data.map((item: any) => item.translatedText || "");
      }
      if (data.translatedText && texts.length === 1) {
        return [data.translatedText];
      }
      return texts.map((_, i) => data[i]?.translatedText ?? "");
    },
  };
}

/**
 * Claude (Anthropic) プロバイダー
 * バックグラウンドスクリプト経由でAPIを呼び出す
 */
function createClaudeProvider(): TranslationProvider {
  return {
    async translate(texts: string[], targetLang: string): Promise<string[]> {
      console.log("[Translator] バックグラウンドスクリプトに翻訳リクエストを送信:", {
        textCount: texts.length,
        targetLang,
      });

      return new Promise((resolve, reject) => {
        const message = {
          type: "TRANSLATE_TEXTS",
          texts,
          targetLang,
        };

        (chrome.runtime.sendMessage as any)(
          message,
          (response: { success?: boolean; translations?: string[]; error?: string } | undefined) => {
            const lastError = (chrome.runtime as any).lastError;
            if (lastError) {
              console.error("[Translator] メッセージ送信エラー:", lastError);
              reject(new Error(lastError.message));
              return;
            }

            if (response?.success && response.translations) {
              console.log("[Translator] 翻訳成功:", {
                translationCount: response.translations.length,
              });
              resolve(response.translations);
            } else {
              console.error("[Translator] 翻訳失敗:", response?.error);
              reject(new Error(response?.error || "翻訳に失敗しました"));
            }
          }
        );
      });
    },
  };
}

/**
 * ダミープロバイダー（開発・テスト用）
 */
function createDummyProvider(): TranslationProvider {
  return {
    async translate(texts: string[], target: string): Promise<string[]> {
      // デモ用: テキストの前に言語タグを付ける
      return texts.map((text) => `[${target}] ${text}`);
    },
  };
}

// ====== 初期化とメッセージハンドラー ======

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
        if (!showOriginal) {
          const existingDisplays = document.querySelectorAll(".translator-original-display");
          existingDisplays.forEach((display) => display.remove());
          
          // すべてのイベントリスナーを削除（AbortControllerで管理）
          const elementsWithTooltip = document.querySelectorAll("[data-tooltip-handler-added]");
          elementsWithTooltip.forEach((element) => {
            const controller = tooltipControllers.get(element as HTMLElement);
            if (controller) {
              controller.abort();
              tooltipControllers.delete(element as HTMLElement);
            }
            element.removeAttribute("data-tooltip-handler-added");
          });
        } else {
          // 原文表示がONになった場合、既存の翻訳済み要素に対してツールチップを再追加
          for (const [key, state] of translationState.entries()) {
            if (state.current !== state.original) {
              const target = locateTargetByKey(key);
              if (target) {
                // 既存のツールチップハンドラーを削除（再追加のため）
                if (target.type === "text" && target.node.nodeType === Node.TEXT_NODE) {
                  const parent = target.node.parentElement;
                  if (parent) {
                    const controller = tooltipControllers.get(parent);
                    if (controller) {
                      controller.abort();
                      tooltipControllers.delete(parent);
                    }
                    parent.removeAttribute("data-tooltip-handler-added");
                  }
                } else if (target.type === "attr" && target.node instanceof HTMLElement) {
                  const element = target.node;
                  const controller = tooltipControllers.get(element);
                  if (controller) {
                    controller.abort();
                    tooltipControllers.delete(element);
                  }
                  element.removeAttribute("data-tooltip-handler-added");
                }
                // ツールチップを再追加
                addOriginalTooltip(target, state.original);
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
