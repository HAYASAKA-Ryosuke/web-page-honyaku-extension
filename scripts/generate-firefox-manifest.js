#!/usr/bin/env node
/**
 * Firefox用のmanifest.jsonを生成するスクリプト
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

// manifest.tsから設定を読み込む（簡易版）
const manifest = {
  manifest_version: 3,
  name: "translation-extension",
  description: "",
  version: "0.1.0",
  action: {
    default_title: "translation-extension",
    default_popup: "src/popup.html"
  },
  background: {
    service_worker: "assets/background.js",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["https://*/*"],
      js: ["assets/content.js"],
      run_at: "document_idle"
    }
  ],
  permissions: ["storage", "contextMenus", "activeTab"],
  host_permissions: ["https://api.anthropic.com/*"],
  browser_specific_settings: {
    gecko: {
      // Firefox Add-ons公開用の拡張機能ID（メールアドレス形式）
      // GitHubリポジトリベースの形式を使用
      // 独自ドメインがある場合は、それを使用することも可能
      id: "translator-mailer@hayasaka-ryosuke.github.io",
      strict_min_version: "109.0"
    }
  }
};

const distDir = join(rootDir, "dist-firefox");
mkdirSync(distDir, { recursive: true });

const manifestPath = join(distDir, "manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log("✅ Firefox用のmanifest.jsonを生成しました:", manifestPath);

