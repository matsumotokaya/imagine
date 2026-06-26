# R2 Migration Design (画像ストレージの Cloudflare R2 移行)

> **Status: PLANNING / READY TO START** — 実データ照合済み・方針確定。Phase 0（インフラ）はユーザー操作待ち。
> 最終更新: 2026-06-26
> 対象: IMAGINE（`imagine/`）の Supabase プロジェクト **BANALIST**（ref `rgqduwojvylkulhyodqg`）

## 0. 背景と確定方針

Supabase 無料プランの **Storage 1GB** を超過（実測 **約1.75GB**）。容量の本体は削除では減らせない正当な参照中コンテンツ。
→ **増えていく画像アセットはすべて Cloudflare R2 に置き、Supabase Storage を新規書き込みから外す**。Supabase は容量が増えない小規模な静的素材だけに留める（理想は空に近づける）。

**確定事項（2026-06-26）**
- 配信先: **新バケット `whatif-assets` + カスタムドメイン `assets.whatif-ep.xyz`**。
- 方針: **新規書き込みは最初から全部 R2**。既存ファイルは**リスク順にバックフィル**（スコープ分割ではなく順番の管理）。
- 最難所は **banners/templates の JSONB `elements[].src` に焼き込まれた full URL** → 最後に入念にテストして実施。

## 0.1 実装ログ（2026-06-26）— Phase 1 コア = production出力のみ

> 「新規書込は全部R2」が最終形だが、安全に切れる順序として **production出力を最初に**実装した。
> 理由: production は (a) `production_outputs.storage_provider` 列が既設、(b) **固定ファイル名で upsert 上書き＝孤立ファイルが出ない**（R2 delete 未実装でも安全）、(c) URL生成箇所が `gallerySync` のみで読み取り更新が局所。
> banner thumbnail/fullres と library(default_images/user_images) を**先送り**したのは、前者が**リビジョン付きファイル名＝旧版deleteが必要**（R2 delete経路が未実装だと孤立増殖）、後者が**provider列のDDL＋多数の読み取り更新**を要するため。

**実装済み（コード）**
- `src/utils/assetUrl.ts`（新規）: `resolveAssetUrl(provider,bucket,key,version)` / `getR2PublicUrl` / `toR2Key` / `isR2Configured` / `appendCacheBust`（移設）。R2キー = `{logicalBucket}/{path}`。
- `src/utils/r2Upload.ts`（新規）: `uploadBlobToR2` = Edge Function `r2-presign` で署名 → 直 PUT。
- `supabase/functions/r2-presign/index.ts`（新規）: JWT検証＋キー権限（`user-images/{uid}/…`本人のみ / `default-images/…`admin）＋`aws4fetch`でR2 presigned PUT。
- `src/utils/storage.ts`: アップロードヘルパーに **opt-in `options.r2`** を追加（既定はSupabase）。`appendCacheBust`を`assetUrl`から再export。
- `src/utils/productionOutputBuilder.ts`: production アップロードを `r2:true`、`storage_provider` を `isR2Configured?'r2':'supabase'`。
- `src/utils/gallerySync.ts`: feed URL生成を `resolveAssetUrl`（provider対応）に。
- （Gallery別repo）`whatif-ep-xyz/next.config.ts`: `images.remotePatterns` に `assets.whatif-ep.xyz` 追加。

**起動前に必要（ユーザー作業）**
- Edge Function デプロイ: `supabase functions deploy r2-presign`（R2シークレットは投入済み）。
- IMAGINE Vercel に `VITE_R2_PUBLIC_BASE_URL=https://assets.whatif-ep.xyz`。
- Gallery を再デプロイ（remotePatterns反映）。

**未対応（後続フェーズ）**: R2 delete 経路（presigned DELETE）／banner assets の R2化／library(default_images・user_images) の provider列DDL＋読み取り更新／既存ファイルのバックフィル（Phase 2-4）。

## 1. 実測した現状（2026-06-26, Supabase MCP read-only）

### 1.1 バケット別

| bucket | objects | サイズ |
|---|---|---|
| `user-images` | 1224 | **1384 MB** |
| `default-images` | 364 | **369 MB** |
| 合計 | | **約1753 MB（1.75GB）** |

### 1.2 `user-images` の内訳（オーナー1アカウント `9c1674eb…` が 1042件 / 1357MB ＝ 98%）

| prefix | objects | サイズ | 参照形態 | 移行難度 |
|---|---|---|---|---|
| `{uid}/production/` | 406 | **891 MB** | `production_outputs.storage_path`（**provider列既設**） | 低（列） |
| `{uid}/downloads/` | 68 | **202 MB** | `banners.fullres_url`（full URL列） | 中（列・URL書換） |
| `{uid}/{ts}-{rand}.png`（root upload） | ~多数 | **~244 MB** | **banners/templates `elements[].src`（JSONB full URL）** | 高（JSONB） |
| `{uid}/migrated/` | 33 | 12 MB | 〃 / 列 | 中 |
| `{uid}/thumbnails/` | 386 | 8 MB | `banners/templates.thumbnail_url`（full URL列） | 中（列・URL書換） |

→ **公開・列ベースの `production`(891MB) + `default-images`(369MB) を出すだけで Supabase は約0.49GB（1GB未満）**。これを最初の山にする。

## 2. 現状の実装（移行で触る箇所）

### 2.1 URL の作り方
- `getSupabaseStoragePublicUrl(bucket, path)` → `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`（[src/utils/supabase.ts](../src/utils/supabase.ts)）
- `versionAssetUrl(url, updatedAt)` / `appendCacheBust()` が `?v=updatedAt` を付与（[src/utils/bannerStorage.ts](../src/utils/bannerStorage.ts) / `storage.ts`）。R2 公開URLでもクエリ文字列は無害。

### 2.2 参照の保存形態（移行の最難所マップ）

| 保存先 | 形態 | 移行 |
|---|---|---|
| `production_outputs.storage_provider/storage_bucket/storage_path` | **provider列既設** | provider を `r2` に切替＋key維持で済む |
| `default_images.storage_path` / `thumbnail_path` | bucket相対パス | provider列を足す or 解決をR2固定 |
| `banners.thumbnail_url` / `fullres_url` | full URL列 | URL書換（列） |
| `templates.thumbnail_url` | full URL列 | URL書換（列） |
| `banners.elements` / `templates.elements` | **JSONB配列内 image要素 `src`（full URL）** | **最難所**：JSONB走査置換 |

### 2.3 アップロードを書く実装（R2に振り向ける対象）
- `src/utils/productionOutputBuilder.ts`（`storage_provider:'supabase'` の既設例 → `'r2'` へ）
- `src/utils/bannerStorage.ts`（`{uid}/thumbnails/…`, `{uid}/downloads/…`）
- `src/utils/storage.ts`（`uploadDataUrlToBucket` 等の共通アップロード）
- `src/components/ImageLibraryModal.tsx`（default / user アップロード）

### 2.4 クロスアプリ依存（重要）
- `src/utils/gallerySync.ts` が `production_outputs.storage_bucket/storage_path` から**Gallery(whatif-ep.xyz)用の公開URL**を生成し、canonical `work_variants`（feed画像）へ反映している。
  → production を R2 化したら **gallerySync の URL 生成も `resolveAssetUrl` 経由（R2）**にすること。Gallery 側（別リポジトリ `whatif-ep-xyz`）が壊れないか必ず検証。

## 3. ターゲット・アーキテクチャ

### 3.1 共通リゾルバ（読み取り統一）
```ts
// provider 非依存でURLを解決。移行中は supabase / r2 を併用できる。
function resolveAssetUrl(
  provider: 'supabase' | 'r2',
  bucket: string,
  key: string,
  version?: string
): string
// r2       → `${R2_PUBLIC_BASE_URL}/${key}` (+ ?v=version)   ※bucketは単一なら省略可
// supabase → getSupabaseStoragePublicUrl(bucket, key) (+ ?v=version)
```
- 全画面の読み取りをこの関数に集約。full URL を直接保存する箇所は段階的に `{provider,bucket,key}` 化していく。

### 3.2 アップロード（presigned PUT 方式）
ブラウザに R2 認証情報は置けない。**Supabase Edge Function で presigned PUT URL を発行**:
1. クライアント → Edge Function `r2-presign` に「この key にアップしたい」と要求（Supabase JWT 付き）。
2. Edge Function が JWT 検証＋key の権限チェック（`{uid}/…` を強制）後、R2 への presigned PUT URL を返す。
3. クライアントが R2 に直接 PUT。
4. 完了後、DBに `{provider:'r2', bucket, key}`（or R2 full URL）を記録。
- R2 は S3 互換 → `@aws-sdk/s3-request-presigner` で presign。

### 3.3 アクセス制御
- 公開バケット（`whatif-assets`）で配信。GET は認証不要。
- private なユーザー画像も当面は公開バケットに置く（URL が推測困難な key 運用）。厳密な非公開要件が出たら署名GET/Worker認証を後続で検討。

### 3.4 CORS
- R2 バケットに CORS 設定：`PUT`,`GET`、`Origin: https://app.whatif-ep.xyz`（および dev: `http://localhost:5173`）。

## 4. 実装シーケンス（スコープではなく“順番”）

> 方針: **新規書き込みは即 R2**。既存はリスク順にバックフィル。各 Wave 後に検証してから Supabase 側を削除。

### Phase 0 — インフラ整備（**ユーザー操作 / Cloudflare・Supabase**）
- [ ] R2 バケット `whatif-assets` 作成（Cloudflare R2）
- [ ] カスタムドメイン `assets.whatif-ep.xyz` をバケットに接続（Cloudflare DNS は既存。Proxy/公開設定に注意）
- [ ] R2 API トークン発行（S3互換）→ Account ID / Access Key ID / Secret
- [ ] バケットに CORS 設定（PUT/GET, app・localhost オリジン）
- [ ] シークレット投入: Supabase Edge Function secrets に `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET=whatif-assets`
- [ ] Vercel（フロント）に `VITE_R2_PUBLIC_BASE_URL=https://assets.whatif-ep.xyz`

### Phase 1 — 読み取り統一＋新規書き込みをR2へ（コード / Claude）
- [ ] `resolveAssetUrl` 実装、読み取り経路を集約
- [ ] Edge Function `r2-presign` 実装・デプロイ（JWT検証＋key権限）
- [ ] アップロード経路をR2へ: production出力 / banner thumbnail・fullres / user upload / default-images
- [ ] `gallerySync` の production URL を `resolveAssetUrl`（R2）に変更し Gallery を検証

### Phase 2 — 既存バックフィル Wave A（列ベース・低リスク）
- [ ] `production/`（891MB）→ R2 コピー＋`production_outputs.storage_provider='r2'`
- [ ] `default-images`（369MB）→ R2 コピー＋参照切替
- [ ] `downloads/`(fullres) / `thumbnails/` → R2 コピー＋`fullres_url`/`thumbnail_url` 列をR2 URLへ書換
- [ ] 各々ドライラン→冪等スクリプト。完了後 Gallery/エディタ/一覧/Content Factory/書き出しを検証

### Phase 3 — 既存バックフィル Wave B（JSONB・最難所）
- [ ] root upload（~244MB）を R2 コピー
- [ ] `banners.elements` / `templates.elements` の image `src`（旧Supabase URL → 新R2 URL）を**走査置換**
- [ ] 旧→新URLマッピング表で冪等化。**置換前後で全保存プロジェクトの画像が壊れないことを必ずテスト**

### Phase 4 — 検証 → Supabase 旧オブジェクト削除
- [ ] 全画面検証後、`/admin/storage-cleanup`（[src/pages/StorageCleanup.tsx](../src/pages/StorageCleanup.tsx)）等で Supabase 側の旧ファイルを削除
- [ ] Supabase Storage を「肥大化しない静的素材のみ」状態へ

## 5. 追加する環境変数

| 変数 | 用途 | 置き場所 |
|---|---|---|
| `VITE_R2_PUBLIC_BASE_URL` | 配信ベースURL（`https://assets.whatif-ep.xyz`） | Vercel（フロント公開） |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | presign用（**フロントに出さない**） | Supabase Edge Function secrets |
| `R2_BUCKET` | 対象バケット（`whatif-assets`） | Edge Function（必要ならフロントも） |

## 6. リスク・要検討

1. **JSONB内 full URL 書換**（Phase 3・最大の難所）。banners/templates の elements を壊さず一括置換するスクリプトの設計・ドライラン・テストが必須。
2. **Gallery 整合**（`gallerySync`）。production の R2 化が whatif-ep.xyz 側の feed 画像を壊さないか検証。
3. **CORS / presign 権限**。`{uid}/…` 以外に PUT できないよう Edge Function で強制。
4. **DB 書き込みは手動**。MCP は read-only。スキーマ変更・バックフィルの DML/DDL は SQL を提示してユーザーが実行（[[supabase-writes-manual]]）。
5. **キャッシュ**: 独自ドメイン＋`?v=` で十分か、Cloudflare Cache 設定が要るか。

## 7. 参考（関連実装）
- `src/utils/supabase.ts` — `getSupabaseStoragePublicUrl`
- `src/utils/storage.ts` — `uploadDataUrlToBucket` / `removeFilesFromBucket`
- `src/utils/bannerStorage.ts` — thumbnails/downloads 保存・`versionAssetUrl`
- `src/utils/productionOutputBuilder.ts` — `storage_provider`（provider列の既設例）
- `src/utils/gallerySync.ts` — production → Gallery 公開URL同期（クロスアプリ）
- `src/components/ImageLibraryModal.tsx` — default/user アップロード
- `src/pages/StorageCleanup.tsx` — 削除フロー（Phase 4 で流用）
- `src/data/theClubThumbnails.ts` — 既存 R2 公開URL利用例
