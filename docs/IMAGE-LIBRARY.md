# 画像ライブラリ仕様書

最終更新: 2026-02-14

---

## 概要

画像ライブラリは、キャンバスエディタで使用する画像を管理する機能。
2つのカテゴリに分かれており、それぞれ異なるStorageバケットとDBテーブルを使用する。

---

## 現在の構成

`user_images` は、単なる個人アップロード置き場ではなく、`作品メタデータ付きアセット台帳` として使う。

- 一般ユーザーが editor から入れる画像
- admin が Content Factory から入れる公式素材

この 2 つを同じテーブルで管理し、`asset_scope` で区別する。

## 2つのカテゴリ

| | プレミアムライブラリ | ユーザーアップロード |
|---|---|---|
| **用途** | 全ユーザーに提供する公式素材 | ユーザーが自分用にアップした画像 |
| **Storage バケット** | `default-images` | `user-images` |
| **DB テーブル** | `default_images` | `user_images` |
| **user_id カラム** | なし | あり |
| **可視性** | 全ユーザー（プレミアム限定も可） | アップしたユーザー本人のみ |
| **アップロード権限** | adminユーザーのみ | ログイン済みユーザー全員 |
| **UIタブ名** | 「プレミアムライブラリ」 | 「アップロード」 |

`user_images` の追加メタデータ:

- `asset_scope`: `user` | `official`
- `source_context`: `editor` | `content_factory` | `automation` | `migration`
- `work_series_slug`
- `work_number`
- `variant_number`
- `asset_role`
- `tags`
- `notes`

つまり、Content Factory からの公式素材は `user-images` バケットに置きつつ、`episode 0465-1 の character cutout` のように識別できる。

### ファイル名の生成ルール

アップロード時、ファイル名は一意になるよう自動生成される：

```
{タイムスタンプ}-{ランダム文字列}-{元ファイル名}
```

例: `1770500000000-xyz123-photo.png`

同名ファイルをアップロードしても衝突しない。

---

## 画像の参照方式

### キャンバス要素での保持

バナーやテンプレートの `elements` JSON配列内で、画像要素は **Supabase StorageのパブリックURL** を直接保持する：

```json
{
  "type": "image",
  "src": "https://{project}.supabase.co/storage/v1/object/public/user-images/{user_id}/{filename}",
  "width": 800,
  "height": 600
}
```

- URLにはバケット名（`default-images` or `user-images`）が含まれる
- バケット間でファイルを移動すると、URLが変わるため既存の参照が壊れる
- DB上の外部キー制約は**存在しない**（`elements`はJSONB型のため）

### テンプレート作成時の挙動

adminがバナーをテンプレートとして保存する際、`elements`配列が**そのままコピー**される。
テンプレート内の画像URLは、元のバナーと同じStorageファイルを参照し続ける。

---

## 削除に関する仕様

### 現在の仕様（2026-02-14時点）

- **UIからの削除機能は無効化済み**（ユーザー・admin両方）
- admin向けには「DBから直接管理してください」という案内を表示
- 削除が必要な場合は、Supabase Dashboardから手動で行う

### 削除が危険な理由

Storageからファイルを削除すると、そのURLを参照している全てのバナー・テンプレートで画像が表示されなくなる。

**影響範囲：**

| 削除対象 | 影響を受けるもの | 影響範囲 |
|---------|---------------|---------|
| ユーザーアップロード画像 | そのユーザーのバナー | 本人のみ |
| プレミアムライブラリ画像 | 全ユーザーのバナー + テンプレート | **全体** |

**壊れた参照が発生した場合の挙動：**

1. キャンバス上に画像の枠（位置・サイズ）は残る
2. 画像の中身は空白（何も表示されない）
3. 選択やドラッグは可能だが、視覚的に見えない
4. PNGエクスポートでも空白のまま
5. コンソールに `Failed to load image` エラーが出力される

### 安全な削除手順（DBレコードのみ削除）

Storageファイルを残し、DBテーブルのレコードだけ削除する方法：

```sql
-- プレミアムライブラリを全クリア（Storageは残る）
DELETE FROM public.default_images;

-- 特定画像のみ削除
DELETE FROM public.default_images WHERE name = '画像名';
```

- ライブラリ画面からは消える
- 既に配置済みのバナー・テンプレートの画像は引き続き表示される
- Storageに孤立ファイルが残るが、機能的な問題はない

---

## 使用状況の確認SQL

### バナーで使用されている画像の一覧

```sql
SELECT
  b.id AS banner_id,
  b.name AS banner_name,
  elem->>'src' AS image_src
FROM public.banners b,
  jsonb_array_elements(b.elements) AS elem
WHERE elem->>'type' = 'image'
  AND elem->>'src' LIKE '%supabase%'
ORDER BY b.name;
```

### テンプレートで使用されている画像の一覧

```sql
SELECT
  t.id AS template_id,
  t.name AS template_name,
  elem->>'src' AS image_src
FROM public.templates t,
  jsonb_array_elements(t.elements) AS elem
WHERE elem->>'type' = 'image'
ORDER BY t.name;
```

---

## 既知の課題と技術的負債

### 🔴 致命的：画像参照の整合性が保証されない

**現状：** バナー・テンプレートの `elements` JSONB内の画像URLと、実際のStorageファイルの間に**整合性制約がない**。

**リスクシナリオ：**

1. **ユーザー削除時**
   - `user_images` テーブル → CASCADE削除される
   - Storage内ファイル → 削除される
   - テンプレート内のURL → **壊れたまま残る**
   - そのテンプレートを使う全ユーザーに影響

2. **adminユーザー変更時（事業売却等）**
   - 現在のadmin（`9c1674eb-...`）のアカウントが削除された場合
   - `user-images/9c1674eb-.../` 配下の全ファイルが削除される可能性
   - このadminが作成したテンプレートの画像が**全て壊れる**
   - プレミアムライブラリの画像（`default-images`バケット）はadminアカウントに紐づかないため影響なし

3. **Storage直接操作時**
   - Supabase Dashboardからファイルを誤って削除
   - 影響範囲の事前把握が困難

### 🟡 中程度：孤立ファイルの蓄積

**現状：** DBレコードだけ削除した場合、Storageにファイルが残り続ける。

**影響：** ストレージ容量の無駄遣い。現時点では少量のため実害なし。

### 🟡 中程度：UIからの削除機能がない

**現状：** 削除ボタンを無効化し、DB直接操作で対応。

**影響：** 運用負荷が高い。ライブラリの画像数が増えた場合に管理が困難になる。

---

## 今後必要な改善（優先度順）

### 1. 画像の参照カウント管理（優先度：高）

画像が使用されている箇所を追跡する仕組みが必要。

**案A：参照カウントテーブル**
```sql
CREATE TABLE image_references (
  image_url TEXT NOT NULL,
  reference_type TEXT NOT NULL,  -- 'banner' | 'template'
  reference_id UUID NOT NULL,
  UNIQUE(image_url, reference_type, reference_id)
);
```

**案B：削除前チェック**
- 削除操作時に全バナー・テンプレートのelementsを検索
- 使用中の場合は警告を表示

### 2. テンプレート画像の独立化（優先度：高）

テンプレート作成時に、画像ファイルを専用バケット（`template-images`）にコピーする。
これにより、元のユーザーが削除されてもテンプレートの画像は維持される。

### 3. adminユーザー変更時の移行手順（優先度：高）

adminが変わる場合に備えた移行手順書の整備：

- 新adminアカウントの作成・role設定
- 旧adminの `user-images` 内ファイルの移行
- テンプレート内URLの書き換え
- 旧adminアカウントは削除せず無効化のみ推奨

### 4. 安全な削除機能の実装（優先度：中）

- 削除前に使用状況をチェック
- 使用中の場合は警告表示
- 未使用の画像のみ削除可能にする

### 5. 孤立ファイルのクリーンアップツール（優先度：低）

- DBに参照がないStorageファイルを検出
- 一括削除のための管理画面 or スクリプト

---

## 運用上の注意事項

1. **adminアカウント（`9c1674eb-...` / matsumotokaya@gmail.com）は絶対に削除しない**
   - テンプレートとバナーがこのユーザーの `user-images` を参照している
2. **プレミアムライブラリ画像の削除はDBレコードのみにする**
   - Storageファイルは残し、既存バナーへの影響を防ぐ
3. **テンプレート作成前に、使用する画像がプレミアムライブラリ（default-images）にあることを推奨**
   - `user-images` の画像は特定ユーザーに依存するため

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/components/ImageLibraryModal.tsx` | ライブラリUI（モーダル） |
| `src/components/canvas/ImageRenderer.tsx` | キャンバス上の画像レンダリング |
| `src/types/template.ts` | ImageElement型定義 |
| `src/utils/bannerStorage.ts` | バナーの保存・読み込み |
| `src/utils/templateStorage.ts` | テンプレートの保存・読み込み |
| `src/pages/BannerEditor.tsx` | 画像アップロード・テンプレート作成 |
