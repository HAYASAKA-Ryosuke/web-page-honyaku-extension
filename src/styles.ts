// ====== スタイル関連 ======

/**
 * 翻訳中表示用のスタイルを追加
 */
export function injectLoadingStyles(): void {
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

/**
 * 原文表示用のスタイルを追加
 */
export function injectTooltipStyles(): void {
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
      white-space: normal;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      border: 1px solid #e0e0e0;
      max-height: min(400px, calc(100vh - 80px));
      overflow-y: auto;
      overflow-x: hidden;
      top: auto;
      bottom: auto;
    }
    .translator-original-display::-webkit-scrollbar {
      width: 8px;
    }
    .translator-original-display::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    .translator-original-display::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }
    .translator-original-display::-webkit-scrollbar-thumb:hover {
      background: #555;
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
      opacity: 1;
      transition: opacity 0.2s;
      pointer-events: auto;
      flex-shrink: 0;
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

