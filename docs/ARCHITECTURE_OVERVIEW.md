# WHATIF アーキテクチャ全体像（→ 横断の正本は Gallery リポジトリ）

> このリポジトリ（**IMAGINE**, `app.whatif-ep.xyz`）は WHATIF の**編集ツール**。
> WHATIF は Gallery と IMAGINE の**2リポジトリ**で構成され、1つのSupabaseを共有している。

「どっちを・どう見ればいいか」を含む**横断アーキテクチャの正本は Gallery リポジトリ側**にある:

- **`github.com/matsumotokaya/whatif-ep-xyz` → `docs/ARCHITECTURE_OVERVIEW.md`**（最初に読む / CTO相談用）

## このリポジトリで見るべき詳細設計

- `docs/ASSET_REFERENCE_REDESIGN.md` — 画像参照モデルのゼロベース再設計（画像表示バグの根治）
- `docs/R2_MIGRATION.md` — Cloudflare R2 への画像移行の履歴・残フェーズ
- `README.md` — IMAGINE の機能・運用の現行説明

## 決定済みの方向性（要約）

Gallery(Next.js) と IMAGINE(Vite SPA) を **1つのNext.jsアプリ・単一ドメイン `whatif-ep.xyz` に統合**する（SSO廃止、エディタは `/edit` のクライアント専用ルート）。詳細・経緯は上記 Gallery 側 `ARCHITECTURE_OVERVIEW.md` と `whatif-ep-xyz/docs/CONSOLIDATION_PLAN.md` を参照。
</content>
