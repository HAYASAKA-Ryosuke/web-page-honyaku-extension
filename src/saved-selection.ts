// ====== 右クリック時に保存した選択範囲 ======
// コンテキストメニュー表示で選択が消えるため、右クリック時点の選択を保持する

export interface SavedSelection {
  text: string;
  range: Range;
}

let saved: SavedSelection | null = null;

export function setSavedSelection(selection: Selection): void {
  if (!selection || selection.rangeCount === 0) {
    saved = null;
    return;
  }
  const range = selection.getRangeAt(0);
  const text = range.toString().trim();
  if (!text) {
    saved = null;
    return;
  }
  saved = { text, range: range.cloneRange() };
}

export function getAndClearSavedSelection(): SavedSelection | null {
  const out = saved;
  saved = null;
  return out;
}
