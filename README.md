# Web Page Honyaku Extension

ウェブページを翻訳するためのChrome/Firefox拡張です

## 機能
- ページ全体の翻訳
- 選択テキストの翻訳
- 原文表示（マウスオーバー）
- 原文表示のピン止め固定

## インストール方法

### 方法1: GitHub Releasesからインストール（推奨）

GitHub Actionsで自動ビルドされたリリースからインストールできます。

1. [Releases](https://github.com/HAYASAKA-Ryosuke/web-page-honyaku-extension/releases)ページから最新のリリースを開く
2. `extension.zip`ファイルをダウンロード
3. ZIPファイルを解凍
4. Chromeで `chrome://extensions/` を開く
5. 右上の「開発者モード」を有効にする
6. 「パッケージ化されていない拡張機能を読み込む」をクリック
7. 解凍したフォルダを選択（`manifest.json`が含まれているフォルダ）

### 方法2: ソースコードからビルド

#### Chrome用のビルド

```bash
# リポジトリをクローン
git clone https://github.com/HAYASAKA-Ryosuke/web-page-honyaku-extension.git
cd web-page-honyaku-extension

# 依存関係のインストール
pnpm install

# Chrome用のビルド
pnpm build:chrome

# ビルドしたdistフォルダが生成されます
# Chromeで chrome://extensions/ を開き、
# 「開発者モード」を有効にして「パッケージ化されていない拡張機能を読み込む」から
# distフォルダを選択してください
```

#### Firefox用のビルド

```bash
# 依存関係のインストール
pnpm install

# Firefox用のビルド
pnpm build:firefox

# ビルドしたdist-firefoxフォルダが生成されます
# Firefoxで about:debugging を開き、
# 「このFirefox」タブを選択して「一時的なアドオンを読み込む」をクリック
# dist-firefoxフォルダ内のmanifest.jsonを選択してください
```

### APIキーの取り扱い

**この拡張機能ではClaude APIのキーが必要です**
- **APIキーはローカルストレージに保存されます** - ブラウザのストレージAPIを使用して、ユーザーのデバイスにのみ保存されます
- **APIキーは外部に送信されません** - APIキーはAnthropicのAPIサーバーにのみ送信され、他のサーバーには送信されません｡

### 使用方法

1. [Anthropic Console](https://console.anthropic.com/)でAPIキーを取得
2. 拡張機能のポップアップからAPIキーを設定
3. 翻訳したいページで拡張機能を使用

### 開発

#### 必要な環境
- Node.js >= 18.0.0
- pnpm >= 10.0.0

#### セットアップ

```bash
# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev

# ビルド（Chrome用）
pnpm build:chrome

# ビルド（Firefox用）
pnpm build:firefox

# ZIPファイルの作成（Chrome用）
pnpm build:zip:chrome

# ZIPファイルの作成（Firefox用）
pnpm build:zip:firefox
```

### ライセンス

MIT

### プライバシー
- この拡張機能は、翻訳のためにAnthropicのAPIサーバーにテキストを送信します
- APIキーや翻訳テキストは、ユーザーのデバイスにのみ保存されます
- データは外部のサーバーに送信されません（AnthropicのAPIサーバーを除く）