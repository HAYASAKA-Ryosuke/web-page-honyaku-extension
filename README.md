# Translation Extension

ウェブページを翻訳するためのChrome拡張です

## 機能
- ページ全体の翻訳
- 選択テキストの翻訳
- 原文表示（マウスオーバー）
- 原文表示のピン止め固定

## セキュリティに関する重要な注意事項

### APIキーの取り扱い

**このChrome拡張ではClaude APIのキーが必要です**
- **APIキーはローカルストレージに保存されます** - `chrome.storage.local`を使用して、ユーザーのデバイスにのみ保存されます
- **APIキーは外部に送信されません** - APIキーはAnthropicのAPIサーバーにのみ送信され、他のサーバーには送信されません｡

### 使用方法

1. [Anthropic Console](https://console.anthropic.com/)でAPIキーを取得
2. 拡張機能のポップアップからAPIキーを設定
3. 翻訳したいページで拡張機能を使用

### 開発

```bash
# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev

# ビルド
pnpm build
```

### ライセンス

MIT

### プライバシー
- この拡張機能は、翻訳のためにAnthropicのAPIサーバーにテキストを送信します
- APIキーや翻訳テキストは、ユーザーのデバイスにのみ保存されます
- データは外部のサーバーに送信されません（AnthropicのAPIサーバーを除く）