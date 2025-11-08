// ====== 型定義 ======
export interface TranslationProvider {
  translate(texts: string[], targetLang: string): Promise<string[]>;
}

export interface TranslationTarget {
  readonly type: "text" | "attr";
  readonly node: Node | HTMLElement;
  readonly key?: string;
  get(): string | null;
  set(value: string): void;
}

export interface TranslationState {
  original: string;
  current: string;
}

export interface TranslatorConfig {
  provider: TranslationProvider;
  maxBatch: number;
  observe: boolean;
  minTextLen: number;
  attrKeys: string[];
}

