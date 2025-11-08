// ====== ノード逆引き ======
import type { TranslationTarget } from "./types";
import { state } from "./state";

/**
 * キーから翻訳対象を逆引き
 */
export function locateTargetByKey(key: string): TranslationTarget | null {
  const parts = key.split(":");
  if (parts.length < 2) {
    return null;
  }

  const type = parts[0];
  const isAttr = type === "attr";

  if (isAttr && parts.length < 3) {
    return null;
  }

  // nodeIdMapを走査して該当するノードを探す
  // WeakMapは直接走査できないため、document全体を走査する必要がある
  // ただし、これは非効率的なので、別の方法を検討する必要がある
  
  // 簡易的な実装: document全体を走査
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ALL);
  
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeId = state.nodeIdMap.get(node);
    
    if (!nodeId) {
      continue;
    }
    
    if (isAttr) {
      const attrKey = parts[1];
      const expectedNodeId = parts.slice(2).join(":");
      if (nodeId === expectedNodeId && node instanceof HTMLElement) {
        return {
          type: "attr",
          node,
          key: attrKey,
          get: () => node.getAttribute(attrKey) || "",
          set: (value: string) => node.setAttribute(attrKey, value),
        };
      }
    } else {
      const expectedNodeId = parts.slice(1).join(":");
      if (nodeId === expectedNodeId && node.nodeType === Node.TEXT_NODE) {
        return {
          type: "text",
          node,
          get: () => node.nodeValue || "",
          set: (value: string) => {
            node.nodeValue = value;
          },
        };
      }
    }
  }
  
  return null;
}

