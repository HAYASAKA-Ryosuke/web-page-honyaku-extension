#!/usr/bin/env node
/**
 * ビルド済み拡張機能をZIPファイルにパッケージ化するスクリプト
 */
import { existsSync, statSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const DIST_DIR = join(process.cwd(), "dist");
const OUTPUT_FILE = join(process.cwd(), "extension.zip");

function buildZip() {
  // distフォルダが存在するか確認
  if (!existsSync(DIST_DIR)) {
    console.error("❌ distフォルダが見つかりません。先に `pnpm build` を実行してください。");
    process.exit(1);
  }

  console.log("📦 拡張機能をZIPファイルにパッケージ化しています...");

  try {
    // 既存のZIPファイルを削除
    if (existsSync(OUTPUT_FILE)) {
      execSync(`rm -f "${OUTPUT_FILE}"`);
    }

    // zipコマンドでZIPファイルを作成
    // -r: 再帰的にディレクトリを追加
    // -q: 静默モード（進捗を表示しない）
    // -9: 最高圧縮
    // -X: 追加のメタデータを除外
    execSync(
      `cd "${DIST_DIR}" && zip -r -q -9 -X "../extension.zip" .`,
      { stdio: 'inherit' }
    );

    // ファイルサイズを取得
    const stats = statSync(OUTPUT_FILE);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`✅ ZIPファイルを作成しました: ${OUTPUT_FILE}`);
    console.log(`📊 ファイルサイズ: ${sizeInMB} MB`);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    console.error("\n💡 ヒント: zipコマンドがインストールされているか確認してください。");
    console.error("   Ubuntu/Debian: sudo apt-get install zip");
    console.error("   macOS: 通常は標準でインストールされています");
    console.error("   Windows: Git BashまたはWSLを使用するか、7-Zipをインストールしてください");
    process.exit(1);
  }
}

buildZip();

