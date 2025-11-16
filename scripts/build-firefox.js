#!/usr/bin/env node
/**
 * Firefox用のビルドスクリプト
 * 各エントリーポイントを個別にIIFE形式でビルドする
 */
import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

async function buildFirefox() {
  const distDir = resolve(rootDir, "dist-firefox");
  const srcDir = resolve(distDir, "src");
  mkdirSync(distDir, { recursive: true });
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(resolve(distDir, "assets"), { recursive: true });

  // 各エントリーポイントを個別にIIFE形式でビルド
  const entries = [
    { name: "background", input: resolve(rootDir, "src/background.ts") },
    { name: "content", input: resolve(rootDir, "src/content.ts") },
    { name: "popup", input: resolve(rootDir, "src/popup.ts") },
  ];

  for (const entry of entries) {
    console.log(`Building ${entry.name}...`);
    await build({
      entryPoints: [entry.input],
      bundle: true,
      format: "iife",
      globalName: entry.name,
      outfile: resolve(distDir, "assets", `${entry.name}.js`),
      platform: "browser",
      target: "es2020",
      minify: false,
      sourcemap: true,
    });
  }

  // popup.htmlをコピー
  const popupSrc = resolve(rootDir, "src/popup.html");
  const popupDest = resolve(srcDir, "popup.html");
  if (existsSync(popupSrc)) {
    let popupContent = readFileSync(popupSrc, "utf-8");
    popupContent = popupContent.replace(
      '<script type="module" src="./popup.ts"></script>',
      '<script src="../assets/popup.js"></script>'
    );
    writeFileSync(popupDest, popupContent);
  }

  console.log("✅ Firefox用のビルドが完了しました");
}

buildFirefox().catch((error) => {
  console.error("❌ ビルドエラー:", error);
  process.exit(1);
});

