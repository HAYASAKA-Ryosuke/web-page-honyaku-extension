import { vi } from "vitest";

// browser polyfill のモック
const mockBrowser = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1 }]),
    sendMessage: vi.fn(),
  },
  action: {
    setBadgeText: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn().mockResolvedValue(undefined),
    onClicked: {
      addListener: vi.fn(),
    },
  },
};

vi.mock("webextension-polyfill", () => ({
  default: mockBrowser,
}));

// グローバルにモックを公開
(globalThis as any).mockBrowser = mockBrowser;

// clipboard のモック
Object.assign(navigator, {
  clipboard: {
    readText: vi.fn().mockResolvedValue(""),
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});
