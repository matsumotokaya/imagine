# CLAUDE.md - WHATIF プロジェクト仕様

## AGENTS Priority

`/Users/kaya.matsumoto/projects/banalist/AGENTS.md` をこのリポジトリの正本として優先する。

- GitHub アカウント運用
- push / PR 前の確認事項

は、まず `AGENTS.md` を確認する。

最終更新: 2025-11-19

## 📌 プロジェクト概要

**WHATIF** は、Canvaのようなブラウザベースの画像生成サービス。
商用利用可能なバナー広告・サムネイルを、テンプレートとルールベースで生成する。

### コンセプト
- 生成AIで0から画像を作るのではなく、**テンプレート × ルールベース × LLM補助** で品質を担保
- 「セミジェネラティブ」アプローチ
- 商用利用に耐える安定した出力

---

## 🧱 技術スタック

### フロントエンド
- **React** (Vite + TypeScript)
- **TailwindCSS** (スタイリング)
- **Konva.js or Fabric.js** (Canvas編集UI)
  - 最終的にどちらかを選定

### バックエンド（後のフェーズ）
- FastAPI or Node.js (NestJS)
- Sharp / Puppeteer (画像レンダリング)
- Supabase (Auth + DB + Storage)

### LLM（後のフェーズ）
- OpenAI GPT or Claude
- 文言生成・テンプレート推薦・配色提案

---

## 🎯 開発フェーズ

### **フェーズ1: プロジェクト基盤構築** ✅
1. プロジェクトディレクトリ作成 + Git初期化
2. React（Vite）+ TypeScript + TailwindCSS セットアップ
3. 基本的なディレクトリ構成作成

### **フェーズ2: キャンバスエディタUI（コア機能）** 🚧
4. Konva.js or Fabric.js の選定・導入
5. 1920×1080キャンバス表示
6. テンプレート選択UI（ダミー3個）
7. テキスト追加・編集機能
8. 画像配置機能（ダミー素材）
9. レイヤー管理UI

### **フェーズ3: ルールベースエンジン** 📋
10. テキスト量によるフォントサイズ自動調整
11. 配色パレット制限（テンプレート別）
12. レイアウト自動調整ロジック

### **フェーズ4: 画像出力** 📋
13. PNG/JPEG書き出し機能（フロントのみで実装）
14. プレビュー機能

---

## 📁 ディレクトリ構成

```
/Users/kaya.matsumoto/projects/banalist/
├── src/
│   ├── components/     # React コンポーネント
│   ├── hooks/          # カスタムフック
│   ├── types/          # TypeScript型定義
│   ├── utils/          # ユーティリティ関数
│   ├── templates/      # テンプレートデータ
│   └── assets/         # 画像・フォント等の静的ファイル
├── public/             # 公開ファイル
├── tailwind.config.js  # TailwindCSS設定
├── vite.config.ts      # Vite設定
└── CLAUDE.md           # このファイル
```

---

## 🚀 初期スコープ（MVP）

- **テンプレート数**: 1〜3個
- **フォント**: GoogleFonts等から数種類
- **LLM機能**: まだ不要（ルールベースのみ）
- **認証**: 不要

---

## ⚠️ 注意事項

- 親プロジェクト `/Users/kaya.matsumoto/CLAUDE.md` の全般ルールに従う
- コード内コメントは英語のみ（日本語禁止）
- 不明点があれば推測せず必ず質問する

## 🔧 開発サーバー

- `npm run dev` でローカルネットワーク公開（`vite.config.ts` で `server.host: true` 設定済み）
- スマホからの接続: `http://<PCのローカルIP>:5173/` でアクセス可能
- モバイル実機テストを常に行えるようにするための設定
