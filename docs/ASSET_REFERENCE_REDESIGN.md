# Asset Reference Redesign（画像参照モデルのゼロベース再設計）

> Status: **設計（未実装）**。2026-06-29 起案。
> 対象: IMAGINE（`imagine/`）＋ Gallery（`whatif-ep-xyz/`、同一 Supabase プロジェクト `rgqduwojvylkulhyodqg` を共有）。
> 前提: 有料会員ゼロ・実ユーザーほぼ無し。**負債を残さず根本から作り直す**方針。ハイリスクな破壊的変更を許容。
> 関連（履歴）: [R2_MIGRATION.md](./R2_MIGRATION.md)。本書はその「なぜ毎回壊れるのか」を構造から断つための上位設計。
>
> **上位決定（2026-06-29）**: Gallery と IMAGINE は**1つのNext.jsアプリへ統合**する（`whatif-ep-xyz/docs/CONSOLIDATION_PLAN.md`）。よって本書の asset モジュールは**統合アプリ内に1回だけ実装**する。従来案にあった「各アプリに `asset.ts` を並行実装」（§3.3）は**二重化＝バグ源そのもの**なので破棄。統合の中で単一実装する。

---

## 1. なぜ毎回壊れるのか（構造的根本原因）

R2移行で毎日のように「画像が表示されない」が出るのは、個別のうっかりミスではなく**データモデルが移行に対して構造的に脆い**ため。

根っこは1つ:

> **DB に「バックエンド絶対URL」を焼き込んでいる箇所が多数あり、`resolveAssetUrl` は読み取り時しか抽象化していない。書き込み時はいまだフルURLを保存している。**

そのため、保存場所（Supabase / R2）を変えるたびに、**全テーブル・全カラム・JSONB の中まで絶対URLを探して書き換える**作業が必要になる。1フィールドでも漏らすと、元ファイル削除後に無言で 404 になる。これが「参照先を変えるだけなのに漏れが多発する」の正体。

実例（今回のテンプレ全滅）:
- 手動「テンプレートとして保存」は [`BannerEditor.tsx:1599-1600`](../src/pages/BannerEditor.tsx#L1599-L1600) でサムネを `default-images/templates/...` に上げ、**フルURL**を `templates.thumbnail_url` に保存。
- Wave A が `default_images` テーブルだけ provider 反転＋原本削除し、`templates.thumbnail_url`（別カラムのフルURL）を書き換え忘れ → 71件が削除済みURLを指して 404。

### 1.1 参照保存形態が2系統に割れている

| 形態 | 該当 | 移行コスト |
|---|---|---|
| **provider列 + 相対key**（健全） | `production_outputs`(provider/bucket/path)・`default_images`(provider/path) | 列を1つ反転で完了。漏れない |
| **フルURLべた書き**（脆い） | `banners.thumbnail_url`/`fullres_url`・`templates.thumbnail_url`・`banners.elements[].src`/`templates.elements[].src`(JSONB)・`club_items.cover_image_url` | 全行 find-and-rewrite。1箇所漏らすと無言404 |

毎日のバグは、ほぼ全部「後者のどれかを書換忘れ」。さらに次の地雷:

- `bannerStorage.saveThumbnail`/`batchSave` は **`{r2:true}` を付けずに** `uploadDataUrlToBucket` を呼ぶ（[bannerStorage.ts:338,373](../src/utils/bannerStorage.ts#L338)）→ 新規バナーサムネは**今もSupabase + フルURL保存**＝Wave B で必ず壊れる地雷を毎日増やしている。
- 削除は `extractStoragePathFromPublicUrl`（[storage.ts:121](../src/utils/storage.ts#L121)）で**フルURLからパスを逆算**している。これは Supabase URL 専用（`/storage/v1/object/public/`）。R2 URL になった瞬間、削除ロジックが沈黙して**孤立ファイルが溜まる**。
- サムネのキーが `Date.now()-random`（[bannerStorage.ts:13-16](../src/utils/bannerStorage.ts#L13-L16) / [BannerEditor.tsx:1599](../src/pages/BannerEditor.tsx#L1599)）＝ID から再導出できず、削除はURL逆算頼み＝孤立の温床。

### 1.2 テンプレサムネが2バケットに割れる理由（今回の疑問の答え）

テンプレ生成のコードパスが2本あり保存先が違う:
- 手動保存 → `default-images/templates/`（共有バケット）
- Content Factory Publish（WORKS）→ 昇格元バナーの `thumbnail_url` をコピー（[templateStorage.ts `upsertTemplateFromProductionProject`](../src/utils/templateStorage.ts)）。バナーサムネは `user-images/{uid}/thumbnails/`（[bannerStorage.ts:11-14](../src/utils/bannerStorage.ts#L11)）。

→ WORKS は「管理者が作ったバナーを昇格」したものなのでサムネが user-images。矛盾ではなく**経路の不統一**。

---

## 2. 設計原則（ゼロベースで「こうあるべき」）

1. **DB に絶対URLを保存しない。** 画像参照は常に**バックエンド非依存の相対オブジェクトキー**1本で持つ。
   例: `user-images/9c16…/banners/{bannerId}/thumb.jpg`
2. **URL は描画時にだけ組み立てる。** 解決は `${ASSET_BASE_URL}/${key}` の1規則。バックエンドを変える＝**環境変数1つの変更**。行の書換も探索漏れも原理的にゼロになる。
3. **キーは決定的（deterministic）。** エンティティID から一意に導出でき、同じ論理スロットは**上書き（overwrite-in-place）**。`Date.now()-random` を廃止。削除はキー再導出で済み、孤立が出ない。
4. **書き込みヘルパーは URL ではなく key を返す。** `getPublicUrl()` の戻り値を DB に入れる経路を**1本も残さない**（型と lint で禁止）。
5. **読み書きの入口は各アプリ1モジュールに集約。** 直書き禁止。
6. **両アプリで同一のキー規約・同一のベースURL規則**を使う（同じ DB を共有しているため）。

要するに「`resolveAssetUrl` を読み取りだけでなく**保存形態そのもの**に適用する」。

---

## 3. ターゲット・アーキテクチャ

### 3.1 正本の参照表現 = 相対オブジェクトキー（1本）

- 物理ストレージは **R2 単一バケット `whatif-assets`**、配信は `assets.whatif-ep.xyz`。
- キーは**論理バケットをトッププレフィックスに含む**フルキー: `user-images/...` / `default-images/...`。
  （presign の権限判定がこのプレフィックスを使う＝[r2-presign `authorizeKey`](../supabase/functions/r2-presign/index.ts#L35) と整合）
- **`provider` 列は最終的に廃止**。全アセットが R2 単一規則になるため不要。移行期間中だけ「full-URL passthrough」を残し、完了後に削除。

> 設計判断: provider+key を残す案もあるが、ゴールが「Supabase Storage を空にして R2 単一化」である以上、`provider` は移行のためだけの一時的複雑性。ゼロベースなら**bare key 単一**が最もシンプルで、JSONB の `src` もただのキー文字列になり最難所が消える。

### 3.2 決定的キー規約（提案）

| 用途 | キー | 上書き |
|---|---|---|
| バナー サムネ | `user-images/{uid}/banners/{bannerId}/thumb.jpg` | ◯ |
| バナー フルレス | `user-images/{uid}/banners/{bannerId}/full.png` | ◯ |
| ユーザーアップロード素材 | `user-images/{uid}/uploads/{assetId}.{ext}` | ◯ |
| production 出力 | `user-images/{uid}/production/{projectId}/{role}.png` | ◯（既に固定名） |
| 公式/プレミアム ライブラリ | `default-images/library/{assetId}.{ext}`（+ `.../thumb.jpg`） | ◯ |
| テンプレ サムネ | `default-images/templates/{templateId}/thumb.jpg` | ◯ |

- キャッシュ無効化は内容ハッシュではなく `?v={updated_at}`（既存 `appendCacheBust` を踏襲）。固定キー上書き＋`?v=` で十分。
- `{rev}` 乱数を廃止できるのは、上書き＋`?v=` でキャッシュ世代を管理するため。

### 3.3 単一アセットモジュール（各アプリ）

```
// IMAGINE: src/utils/asset.ts（Gallery: src/lib/asset.ts と同一規則）
type AssetKey = string & { __brand: 'AssetKey' }; // 絶対URLの混入を型で防ぐ

resolveAssetUrl(key: AssetKey | null, version?: string): string   // ${BASE}/${key} (+?v=)
uploadAsset(key: AssetKey, blob, contentType): Promise<AssetKey>  // R2 presign PUT → key を返す（URLは返さない）
deleteAsset(keys: AssetKey[]): Promise<void>                      // presign DELETE
buildBannerThumbKey(uid, bannerId) / buildTemplateThumbKey(templateId) / ...  // 決定的キー生成
```

- DB には `AssetKey`（=相対キー）だけを保存。描画は `resolveAssetUrl(row.key, row.updated_at)`。
- これにより「保存先が変わる＝`BASE` を変える」だけになり、**行も JSONB も一切触らない**。

### 3.4 JSONB `elements[].src` の扱い（最難所の解消）

- canvas 要素の `src` には**相対キー**を保存する（外部画像/データURLはスキームありなので区別可能）。
- 読み込み時に `resolveElementSrc(src)`: `isFullUrl(src)`（`^https?:`）or `data:` なら passthrough、それ以外は相対キー→`resolveAssetUrl`。
- 効果: バナー/テンプレの JSONB は**保存先変更の影響を一切受けない**。Phase 3「JSONB走査置換」という移行作業が**今後永久に不要**になる。

### 3.5 削除・GC

- 削除はキー再導出（`buildXxxKey(id)`）で行い、**URL逆算（`extractStoragePathFromPublicUrl`）を廃止**。
- 固定キー上書きなのでリビジョン孤立が出ない。残存孤立は `/admin/storage-cleanup` で参照外を一掃（キー集合 vs バケット一覧の差分）。

### 3.6 例外（自前ストレージでないもの）

- `profiles.avatar_url`: Google等 OAuth の外部URL。**自前アセットでない**ので passthrough のまま（`isFullUrl` で素通り）。
- 外部リンク（`work_offers.target_url`, `episodes.product_url`）は画像ではないので対象外。

---

## 4. スキーマ変更（DDL 概要）

> MCP は read-only。確定後に SQL を提示してユーザーが手動実行（[[supabase-writes-manual]]）。

新カラム（相対キー）を追加 → バックフィル → 読み替え → 旧カラム削除、の順。

| テーブル | 変更 |
|---|---|
| `templates` | `thumbnail_key text` 追加（←`thumbnail_url` から導出）。完了後 `thumbnail_url` 削除 |
| `banners` | `thumbnail_key` / `fullres_key` 追加。完了後 `thumbnail_url` / `fullres_url` 削除 |
| `templates.elements` / `banners.elements` | JSONB 内 `src` を相対キーへ正規化（走査置換・1回限り） |
| `default_images` | `storage_path`/`thumbnail_path` を**論理バケット込みフルキー**へ正規化（`default-images/...`）。`storage_provider` は移行後に削除 |
| `user_images` | 同上（`user-images/{uid}/...`）。provider 概念は持たせず単一規則 |
| `production_outputs` | `storage_bucket`+`storage_path` を単一 `storage_key`（`{bucket}/{path}`）へ集約。`storage_provider` は移行後削除 |
| `club_items` | `cover_image_url`（Gallery側）→ `cover_image_key` へ。要現状確認 |

Gallery 側 `work_variants.thumbnail_storage_key` / `episodes.thumbnail_storage_key` は既にキー方式 → プレフィックス規約（論理バケット込み）に合わせるだけ。

---

## 5. 移行計画（破壊的・一気にやる）

実ユーザーが居ないので段階防御は最小化し、短期間で正本形へ切り替える。

1. **共通モジュール導入**（IMAGINE/Gallery 両方に `asset.ts`、`AssetKey` ブランド型）。読み取りを全部これ経由に。
2. **書き込みを全部 key 返却＋R2 化**（バナーサムネ/フルレス/アップロード/テンプレサムネ/ライブラリ）。`getPublicUrl→DB` 経路を撲滅。`bannerStorage` の `{r2:true}` 漏れ解消。
3. **残ファイルを R2 へバックフィル**（user-images 518MB＋孤立分）＝ R2_MIGRATION の Wave B/C を、ただし「URL書換」ではなく「キー正規化」として実施。
4. **JSONB `elements[].src` をキー化**（全 banners/templates、旧Supabase/R2フルURL→相対キー、冪等マップ）。
5. **新キーカラムへ読み替え** → 全画面検証（一覧/詳細/エディタ/Content Factory/Gallery/壁紙/書き出し）。
6. **旧URLカラム・provider列・full-URL passthrough を削除**。Supabase Storage を空に。

各ステップ後に「壊れたら即気づく」ように、resolver に**キーらしくない値（`http`で始まる等）が来たら dev で警告**を仕込む。

---

## 6. 再発防止（構造で縛る）

- `AssetKey` ブランド型: 絶対URLが DB 書き込み経路に混ざるとコンパイルで弾く。
- CI/grep ガード: `getPublicUrl(`/`/storage/v1/object/public/` を含む文字列を DB へ insert/update する箇所を検出。
- 直書き禁止レビュー規約を CLAUDE.md（imagine）に明記。
- テンプレサムネ生成を**1経路に統合**（手動保存・Publish とも `default-images/templates/{templateId}/thumb.jpg` を上書き、または Publish はバナーキーを共有）。

---

## 7. リスク・要確認

1. **JSONB一括変換**（§5-4）が唯一の本質的高リスク。ただし**1回やれば二度と要らない**（キー化後は移行非依存）。冪等マップ＋全プロジェクト描画テスト必須。
2. **Gallery とのキー規約整合**: 同一 DB を共有。両アプリの `asset.ts` が同一プレフィックス規則・同一 BASE を使うこと。Gallery 既存の `r2-legacy`(`pub-…r2.dev`) 資産の扱い（`assets.whatif-ep.xyz` へ寄せるか、当面 passthrough か）を決める。
3. **presign 権限**: 既存 `authorizeKey`（user-images={uid}本人 / default-images=admin）を維持。新キー規約がこのプレフィックス判定と矛盾しないこと（§3.1で整合済み）。
4. **キャッシュ**: 固定キー上書き＋`?v=updated_at`。Cloudflare のネガティブキャッシュ罠（PUT直後の偽404）は認証S3 HEADで検証（R2_MIGRATION §0.2 の教訓）。
5. `club_items.cover_image_url` / `profiles.avatar_url` の実値を確認してから分類確定。

---

## 8. 着手順（次セッション）

- [ ] §7-5 の実値確認（`club_items.cover_image_url`, `default_images`/`user_images` の storage_path 実フォーマット、elements[].src の現状分布）
- [ ] 共通 `asset.ts`（IMAGINE）＋ Gallery `asset.ts` のAPI確定（§3.3）
- [ ] キー規約の最終確定（§3.2）
- [ ] DDL ドラフト（§4）→ ユーザー実行
- [ ] 書き込み経路の key 化（§5-2、地雷の増殖停止が最優先）
</content>
</invoke>
