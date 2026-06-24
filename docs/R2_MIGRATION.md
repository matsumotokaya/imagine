# R2 Migration Design (画像ストレージの Cloudflare R2 移行)

> **Status: DESIGN ONLY（未実装）** — 次セッションで着手する前提の設計メモ。
> 最終更新: 2026-06-24

## 0. 背景・このドキュメントの位置づけ

Supabase 無料プランの **Storage 1GB / Egress（帯域）** が逼迫しており、実バケット使用量は一時 1.6GB と上限超過していた。
直近で **Storage Cleanup**（`/admin/storage-cleanup`）により fullres キャッシュ（~358MB）＋孤立ファイル（~54MB）をパージ済み。
ただし容量の本体（production 出力 ~560MB、配置画像 ~274MB、default-images ~318MB）は **正当に参照中のコンテンツ**で、削除では減らせない。

→ 根本対策として **公開アセットを Cloudflare R2 へ移し、Supabase の容量・帯域から外す**。本書はその設計のみを残す。

## 1. なぜ R2 か

| | Supabase Storage (Free) | Cloudflare R2 (Free) |
|---|---|---|
| ストレージ | 1 GB | **10 GB** |
| Egress（転送） | 月 ~5GB（プラン依存・課金要因） | **無料（egress 0円）** |
| 認証連携 | Auth/RLS と直結 | 自前（presigned / Worker / 公開バケット） |
| 既存利用 | 全画像 | **The Club 壁紙で利用中**（`pub-9339...r2.dev`, `VITE_THE_CLUB_R2_BASE_URL`） |

egress 無料が効くと、Supabase 帯域だけでなく **Vercel の Image Transformation コスト**圧も下がる（配信が R2 から直接になるため）。

## 2. 現状の実装（移行で触る箇所）

### 2.1 URL の作り方
- `getSupabaseStoragePublicUrl(bucket, path)` →
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`（[src/utils/supabase.ts](../src/utils/supabase.ts)）
- `versionAssetUrl(url, updatedAt)` がキャッシュバスト用に `?v=updatedAt` を付与（[src/utils/bannerStorage.ts](../src/utils/bannerStorage.ts)）。R2 公開URLでもクエリ文字列は無害（無視される）。

### 2.2 参照の保存形態（移行の最難所）
画像参照は **完全な公開URL文字列**で、複数箇所に散在する:

| 保存先 | 形態 | 例 |
|---|---|---|
| `banners.thumbnail_url` / `fullres_url` | 列（full URL） | `.../object/public/user-images/{uid}/...png` |
| `templates.thumbnail_url` | 列（full URL） | 同上 |
| `banners.elements` / `templates.elements` | **JSONB 配列内の image要素 `src`（full URL）** | 同上 |
| `default_images.storage_path` / `thumbnail_path` | 列（bucket相対パス） | `{file}.png` |
| `user_images.storage_path` / `thumbnail_path` | 列（bucket相対パス） | `{uid}/{file}.png` |
| `production_outputs.storage_path` / `storage_bucket` / `storage_provider` | 列（**provider既設**） | `provider='supabase'`, `bucket='user-images'` |

- **`production_outputs` は既に `storage_provider`/`storage_bucket` を持つ**（[productionOutputBuilder.ts:312](../src/utils/productionOutputBuilder.ts)）→ 多プロバイダ前提の設計が一部入っている。これを全体の標準にするのが筋。
- 最難所は **JSONB 内に焼き込まれた full URL**（banners/templates の elements）。ここを書き換えないと移行後に画像が壊れる。

### 2.3 バケット
- `user-images`（ユーザー画像・バナーのサムネ/fullres・production出力）
- `default-images`（プレミアム/公式ライブラリ＝公開）

## 3. ターゲット・アーキテクチャ

### 3.1 配信（read）
- **R2 公開バケット ＋ 独自ドメイン**（推奨: `assets.whatif-ep.xyz` を R2 にカスタムドメイン接続）。
  - 暫定で既存の `*.r2.dev` 公開URLでも可だが、本番は独自ドメイン推奨（キャッシュ/ブランド/将来の差し替え耐性）。
- 公開配信なので GET は認証不要。**private なユーザー画像をどう扱うかは 3.3 で判断**。

### 3.2 アップロード（write）
ブラウザに R2 認証情報は置けないため、**presigned PUT URL 方式**:
1. クライアント → 署名発行エンドポイント（**Supabase Edge Function** もしくは **Cloudflare Worker**）に「このkeyにアップしたい」と要求。
2. エンドポイントが認証（Supabase JWT 検証）＋権限チェック後、R2 への **presigned PUT URL** を返す。
3. クライアントが R2 へ直接 PUT。
4. 完了後、`{provider:'r2', bucket, key}` をDBに記録。
- 署名発行は **Supabase Edge Function を推奨**（既に Supabase Auth があるので JWT 検証が楽。R2 は S3 互換APIなので `@aws-sdk/s3-request-presigner` で presign 可能）。

### 3.3 アクセス制御（public vs private）
- **公開アセット**（`default_images`＝プレミアムライブラリ、`production_outputs`＝公式成果物、テンプレ/バナーのサムネ）→ **R2 公開バケットでOK**。最初の移行対象。
- **private なユーザーアップロード**（`user_images`）→ 選択肢:
  - (a) 当面 Supabase に残す（容量の主因ではない、認証が楽）。
  - (b) R2 + 署名付きGET URL（Worker/Edge で都度発行）or 非公開バケット＋Worker認証。
  - **推奨: フェーズ1では公開アセットのみR2、user_images は Supabase 据え置き。** private のR2化は後続フェーズで判断。

### 3.4 CORS
- ブラウザ直PUTのため、R2バケットに **CORS設定**（`PUT`/`GET`, `Origin: https://app.whatif-ep.xyz` 等）が必要。

## 4. データモデルの方針

**URLを焼き込まず、provider非依存の「key」を持ち、読み取り時にURL解決する**のが理想。ただし既存の full-URL 焼き込みが大量にあるため、現実的には次の二段構え:

1. **新規**: `{storage_provider, storage_bucket, storage_key}` を持つ（production_outputs方式を user_images/default_images/banners assets にも拡張）。読み取りは `resolveAssetUrl(provider, bucket, key, version)` の共通関数で生成。
2. **既存**: full URL の移行は **バックフィル・スクリプトで一括書き換え**（5章）。

共通リゾルバ（新規実装イメージ）:
```ts
function resolveAssetUrl(provider: 'supabase'|'r2', bucket: string, key: string, version?: string): string
// provider==='r2' → `${R2_PUBLIC_BASE}/${bucket}/${key}` (+ ?v=version)
// provider==='supabase' → getSupabaseStoragePublicUrl(bucket, key)
```

## 5. 移行フェーズ計画

### Phase 0 — インフラ整備
- R2 バケット作成（例: `whatif-assets`）、独自ドメイン接続、CORS設定。
- R2 アクセスキー発行（S3互換）。Supabase Edge Function 環境変数に格納。
- presigned URL 発行 Edge Function を実装・デプロイ。
- 環境変数追加（6章）。

### Phase 1 — 新規アップロードをR2へ（公開アセット）
- `default_images` アップロード（[ImageLibraryModal](../src/components/ImageLibraryModal.tsx) の default タブ）を R2 経由に。
- production 出力（[productionOutputBuilder.ts](../src/utils/productionOutputBuilder.ts)）の保存先を R2 に（`storage_provider:'r2'`）。
- 読み取りを `resolveAssetUrl` 経由に統一。

### Phase 2 — 既存ファイルのバックフィル
- スクリプトで Supabase → R2 へコピー（または再アップロード）。
- DB参照を書き換え:
  - 列（thumbnail_url/fullres_url/storage_path 等）。
  - **JSONB**: `banners.elements` / `templates.elements` の image `src` を、旧 Supabase URL → 新 R2 URL に置換（`jsonb` を走査して `replace()`）。**ここが要注意・要テスト**。
- 旧URLと新URLのマッピング表を作り、冪等に実行できるようにする。

### Phase 3 — 検証 → Supビーから削除
- 全画面（エディタ/一覧/ギャラリー/Content Factory/書き出し）で画像が表示されるか検証。
- 問題なければ Supabase 側の旧オブジェクトを削除（既存の Storage Cleanup を流用可能）。

## 6. 追加する環境変数（案）

| 変数 | 用途 | 置き場所 |
|---|---|---|
| `R2_PUBLIC_BASE_URL` (`VITE_` でフロント公開) | 配信ベースURL（例 `https://assets.whatif-ep.xyz`） | Vercel |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | presign用（**フロントに出さない**） | Supabase Edge Function secrets |
| `R2_BUCKET` | 対象バケット名 | 両方 |

## 7. リスク・要検討

1. **JSONB内のfull URL書き換え**（最大の難所）。banners/templates の elements を壊さず一括置換する移行スクリプトの設計・テストが必須。
2. **private user_images の扱い**（公開バケットに置くと誰でもURLで見られる）。フェーズ1では Supabase 据え置きで回避。
3. **CORS / presign の権限設計**（誰がどのkeyにPUTできるか）。
4. **キャッシュ**: 独自ドメイン＋`?v=` で十分か、Cloudflare Cache設定が要るか。
5. **The Club（Gallery）との整合**: 既に R2 を使う Gallery 側と命名規約・ドメインを揃える（`whatif-ep.xyz` 配下の別アプリ。リポジトリも別の可能性）。

## 8. 次セッションの着手チェックリスト

- [ ] R2 バケット＋独自ドメイン＋CORS（Phase 0）
- [ ] presigned URL 発行 Edge Function（Supabase）
- [ ] `resolveAssetUrl` 共通リゾルバ実装＋読み取り経路の統一
- [ ] default_images / production 出力のアップロード先をR2へ（Phase 1）
- [ ] バックフィル・スクリプト（列＋JSONB）設計・ドライラン（Phase 2）
- [ ] 検証 → Supabase 旧オブジェクト削除（Phase 3）

## 参考（現状の関連実装）
- `src/utils/supabase.ts` — `getSupabaseStoragePublicUrl`
- `src/utils/bannerStorage.ts` — `versionAssetUrl`, thumbnail/fullres 保存
- `src/utils/productionOutputBuilder.ts` — `storage_provider:'supabase'`（provider列の既設例）
- `src/components/ImageLibraryModal.tsx` — default/user アップロード
- `src/data/theClubThumbnails.ts` — 既存 R2 公開URL利用例
- `src/pages/StorageCleanup.tsx` — 削除フロー（Phase 3 で流用可）
