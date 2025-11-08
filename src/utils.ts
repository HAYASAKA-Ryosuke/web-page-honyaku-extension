// ====== ユーティリティ関数 ======
import type { TranslationTarget } from "./types";
import { config, nodeIdMap } from "./state";

/**
 * テキストノードが可視かどうかを判定
 */
export function isVisibleTextNode(node: Node): boolean {
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
export function getNodeId(node: Node | HTMLElement): string {
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
export function getTargetKey(target: TranslationTarget): string {
  const nodeId = getNodeId(target.node);
  if (target.type === "attr" && target.key) {
    return `attr:${target.key}:${nodeId}`;
  }
  return `text:${nodeId}`;
}

