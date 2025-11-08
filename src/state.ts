// ====== モジュールスコープの状態 ======
import type { TranslatorConfig, TranslationState } from "./types";
import { createClaudeProvider } from "./provider";

// デフォルト設定（後でAPIキーを読み込んで更新）
export let config: TranslatorConfig = {
  provider: createClaudeProvider(),
  maxBatch: 10, // Claude APIはレート制限があるため、バッチサイズを小さく
  observe: true,
  minTextLen: 1,
  attrKeys: ["alt", "title", "aria-label"],
};

// 設定を初期化
// 注意: APIキーはコンテンツスクリプトでは読み込まない（セキュリティのため）
// APIキーはバックグラウンドスクリプトでのみ使用される
export async function initializeConfig() {
  // バックグラウンドスクリプト経由でAPIを呼び出すプロバイダーを使用
  // APIキーの有無はバックグラウンドスクリプト側でチェックされる
  config.provider = createClaudeProvider();
  console.log("[Translator] Claude APIプロバイダーを初期化しました（バックグラウンド経由）");
}

// 初期化を実行
initializeConfig();

export const translationState = new Map<string, TranslationState>();
export const nodeIdMap = new WeakMap<Node | HTMLElement, string>();

// イベントリスナーの管理用（AbortController）
export const tooltipControllers = new WeakMap<HTMLElement, AbortController>();

// 原文表示の設定（デフォルトはtrue）
export let showOriginal = true;

// 原文表示の設定を読み込む
export async function loadShowOriginalSetting(): Promise<void> {
  const result = await chrome.storage.local.get(["showOriginal"]);
  showOriginal = result.showOriginal !== false; // デフォルトはtrue
}

// 初期化時に設定を読み込む
loadShowOriginalSetting();

let _currentLang: string | null = null;
let _observer: MutationObserver | null = null;
let _isTranslating = false; // 翻訳処理中フラグ

// currentLangのgetter/setter
export function getCurrentLang(): string | null {
  return _currentLang;
}

export function setCurrentLang(lang: string | null): void {
  _currentLang = lang;
}

// observerのgetter/setter
export function getObserver(): MutationObserver | null {
  return _observer;
}

export function setObserver(observer: MutationObserver | null): void {
  _observer = observer;
}

// isTranslatingのgetter/setter
export function getIsTranslating(): boolean {
  return _isTranslating;
}

export function setIsTranslating(value: boolean): void {
  _isTranslating = value;
}

