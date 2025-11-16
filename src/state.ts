// ====== 状態管理クラス ======
import browser from "webextension-polyfill";
import type { TranslatorConfig, TranslationState } from "./types";
import { createClaudeProvider } from "./provider";

/**
 * 翻訳拡張機能の状態を管理するシングルトンクラス
 */
export class TranslatorState {
  private static instance: TranslatorState;

  // 公開プロパティ
  public config: TranslatorConfig;
  public translationState = new Map<string, TranslationState>();
  public nodeIdMap = new WeakMap<Node | HTMLElement, string>();
  public tooltipControllers = new WeakMap<HTMLElement, AbortController>();

  // プライベートプロパティ
  private _currentLang: string | null = null;
  private _observer: MutationObserver | null = null;
  private _isTranslating = false;
  private _showOriginal = true;

  private constructor() {
    // デフォルト設定
    this.config = {
      provider: createClaudeProvider(),
      maxBatch: 10, // Claude APIはレート制限があるため、バッチサイズを小さく
      observe: true,
      minTextLen: 1,
      attrKeys: ["alt", "title", "aria-label"],
    };

    // 初期化を実行
    this.initializeConfig();
    this.loadShowOriginalSetting();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): TranslatorState {
    if (!TranslatorState.instance) {
      TranslatorState.instance = new TranslatorState();
    }
    return TranslatorState.instance;
  }

  /**
   * 設定を初期化
   * 注意: APIキーはコンテンツスクリプトでは読み込まない（セキュリティのため）
   * APIキーはバックグラウンドスクリプトでのみ使用される
   */
  public async initializeConfig(): Promise<void> {
    // バックグラウンドスクリプト経由でAPIを呼び出すプロバイダーを使用
    // APIキーの有無はバックグラウンドスクリプト側でチェックされる
    this.config.provider = createClaudeProvider();
    console.log("[Translator] Claude APIプロバイダーを初期化しました（バックグラウンド経由）");
  }

  /**
   * 原文表示の設定を読み込む
   */
  public async loadShowOriginalSetting(): Promise<void> {
    const result = await browser.storage.local.get(["showOriginal"]);
    this._showOriginal = result.showOriginal !== false; // デフォルトはtrue
  }

  // Getter/Setter
  get currentLang(): string | null {
    return this._currentLang;
  }

  set currentLang(lang: string | null) {
    this._currentLang = lang;
  }

  get observer(): MutationObserver | null {
    return this._observer;
  }

  set observer(observer: MutationObserver | null) {
    this._observer = observer;
  }

  get isTranslating(): boolean {
    return this._isTranslating;
  }

  set isTranslating(value: boolean) {
    this._isTranslating = value;
  }

  get showOriginal(): boolean {
    return this._showOriginal;
  }

  set showOriginal(value: boolean) {
    this._showOriginal = value;
  }
}

// シングルトンインスタンスをエクスポート（後方互換性のため）
export const state = TranslatorState.getInstance();

// 便利なエイリアス（後方互換性のため）
export const config = state.config;
export const translationState = state.translationState;
export const nodeIdMap = state.nodeIdMap;
export const tooltipControllers = state.tooltipControllers;

// Getter関数（後方互換性のため）
export function getCurrentLang(): string | null {
  return state.currentLang;
}

export function setCurrentLang(lang: string | null): void {
  state.currentLang = lang;
}

export function getObserver(): MutationObserver | null {
  return state.observer;
}

export function setObserver(observer: MutationObserver | null): void {
  state.observer = observer;
}

export function getIsTranslating(): boolean {
  return state.isTranslating;
}

export function setIsTranslating(value: boolean): void {
  state.isTranslating = value;
}

export async function initializeConfig(): Promise<void> {
  await state.initializeConfig();
}

export async function loadShowOriginalSetting(): Promise<void> {
  await state.loadShowOriginalSetting();
}

// showOriginalのgetter（後方互換性のため）
export function getShowOriginal(): boolean {
  return state.showOriginal;
}
