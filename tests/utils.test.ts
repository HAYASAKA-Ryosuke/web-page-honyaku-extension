import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// state モジュールをモック
vi.mock("../src/state", () => ({
  state: {
    config: {
      minTextLen: 1,
    },
    nodeIdMap: new Map(),
  },
}));

import { isVisibleTextNode, getNodeId, getTargetKey } from "../src/utils";
import { state } from "../src/state";

describe("Utils functions", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    state.nodeIdMap.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("isVisibleTextNode", () => {
    it("should return false for non-text nodes", () => {
      const div = document.createElement("div");
      expect(isVisibleTextNode(div)).toBe(false);
    });

    it("should return false for empty text nodes", () => {
      const text = document.createTextNode("");
      document.body.appendChild(text);
      expect(isVisibleTextNode(text)).toBe(false);
    });

    it("should return false for whitespace-only text nodes", () => {
      const text = document.createTextNode("   ");
      document.body.appendChild(text);
      expect(isVisibleTextNode(text)).toBe(false);
    });

    it("should return true for visible text nodes", () => {
      // jsdom では offsetParent が常に null なので、position: fixed を使う
      document.body.innerHTML = '<p style="position: fixed;">Hello World</p>';
      const textNode = document.querySelector("p")?.firstChild;
      expect(textNode).not.toBeNull();
      expect(isVisibleTextNode(textNode!)).toBe(true);
    });

    it("should return false for text in script tags", () => {
      const script = document.createElement("script");
      script.textContent = "console.log('test')";
      document.body.appendChild(script);
      const textNode = script.firstChild;
      expect(textNode).not.toBeNull();
      expect(isVisibleTextNode(textNode!)).toBe(false);
    });

    it("should return false for text in style tags", () => {
      const style = document.createElement("style");
      style.textContent = "body { color: red; }";
      document.body.appendChild(style);
      const textNode = style.firstChild;
      expect(textNode).not.toBeNull();
      expect(isVisibleTextNode(textNode!)).toBe(false);
    });

    it("should return false for text shorter than minTextLen", () => {
      (state.config as any).minTextLen = 10;
      document.body.innerHTML = "<p>Hi</p>";
      const textNode = document.querySelector("p")?.firstChild;
      expect(isVisibleTextNode(textNode!)).toBe(false);
      (state.config as any).minTextLen = 1;
    });

    it("should return false for text inside translator-original-display", () => {
      document.body.innerHTML = '<div class="translator-original-display"><p>Original text</p></div>';
      const textNode = document.querySelector("p")?.firstChild;
      expect(textNode).not.toBeNull();
      expect(isVisibleTextNode(textNode!)).toBe(false);
    });
  });

  describe("getNodeId", () => {
    it("should generate unique ID for node", () => {
      const div = document.createElement("div");
      const id = getNodeId(div);
      expect(id).toBeTruthy();
      expect(id.startsWith("n")).toBe(true);
    });

    it("should return same ID for same node", () => {
      const div = document.createElement("div");
      const id1 = getNodeId(div);
      const id2 = getNodeId(div);
      expect(id1).toBe(id2);
    });

    it("should generate different IDs for different nodes", () => {
      const div1 = document.createElement("div");
      const div2 = document.createElement("div");
      const id1 = getNodeId(div1);
      const id2 = getNodeId(div2);
      expect(id1).not.toBe(id2);
    });
  });

  describe("getTargetKey", () => {
    it("should generate text key for text target", () => {
      const textNode = document.createTextNode("test");
      const target = {
        type: "text" as const,
        node: textNode,
        get: () => "test",
        set: () => {},
      };
      const key = getTargetKey(target);
      expect(key.startsWith("text:")).toBe(true);
    });

    it("should generate attr key for attribute target", () => {
      const element = document.createElement("input");
      const target = {
        type: "attr" as const,
        node: element,
        key: "placeholder",
        get: () => "test",
        set: () => {},
      };
      const key = getTargetKey(target);
      expect(key.startsWith("attr:placeholder:")).toBe(true);
    });

    it("should return same key for same target", () => {
      const textNode = document.createTextNode("test");
      const target = {
        type: "text" as const,
        node: textNode,
        get: () => "test",
        set: () => {},
      };
      const key1 = getTargetKey(target);
      const key2 = getTargetKey(target);
      expect(key1).toBe(key2);
    });
  });
});
