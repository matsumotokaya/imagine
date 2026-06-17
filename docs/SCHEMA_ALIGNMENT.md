# Schema Alignment

最終更新: 2026-06-17

## Purpose

`imagine` の今後の開発効率を上げるため、`コードが前提にしているスキーマ` と `各環境の実スキーマ` を一致させる。

この資料は:

1. 実測した production schema の要点
2. コードが要求している canonical schema
3. migration の適用順

を一箇所にまとめる。

## Production Audit Snapshot

2026-06-17 時点の service role 実測:

### `banners`

存在確認済み:

- `id`
- `user_id`
- `name`
- `template`
- `elements`
- `canvas_color`
- `thumbnail_data_url`
- `thumbnail_url`
- `created_at`
- `updated_at`
- `display_order`
- `is_public`
- `template_id`

当初欠けていたもの:

- `fullres_url`

この欠落により、一覧取得と autosave が `column banners.fullres_url does not exist` で壊れた。

### `templates`

存在確認済み:

- `display_order`
- `width`
- `height`
- `like_count`
- `open_count`

### `user_images`

不足確認済み:

- `asset_scope`
- `source_context`
- `work_series_slug`
- `work_number`
- `variant_number`
- `asset_role`
- `tags`
- `notes`

この拡張は入れたが、最新方針では `user_images` を公式素材台帳にはしない。
今後は private upload のみを主用途とし、`asset_scope = user` を基本とする。

### `default_images`

追加が必要:

- `source_context`
- `work_series_slug`
- `work_number`
- `variant_number`
- `asset_role`
- `notes`

公式素材を直接ここへ登録するため、`default_images` 側が `作品メタデータ付きプレミアムアセット台帳` になる。

### Existing RPC

存在確認済み:

- `get_admin_stats`
- `increment_template_open_count`
- `increment_display_orders`

## Canonical Schema

現時点で canonical とみなす対象は以下。

### `banners`

必須:

- `fullres_url`
- `is_public`
- `display_order`
- `template_id`

### `templates`

必須:

- `display_order`
- `width`
- `height`
- `like_count`
- `open_count`

### `user_images`

必須:

- `asset_scope`
- `source_context`
- `work_series_slug`
- `work_number`
- `variant_number`
- `asset_role`
- `tags`
- `notes`

用途:

- private uploads
- legacy compatibility cleanup

### `default_images`

必須:

- `source_context`
- `work_series_slug`
- `work_number`
- `variant_number`
- `asset_role`
- `tags`
- `notes`

## Canonical Migration Set

現時点で揃えるべき migration は以下。

1. [20260617_align_core_schema.sql](/Users/kaya.matsumoto/projects/whatif/imagine/supabase/migrations/20260617_align_core_schema.sql)
2. [20260617_expand_user_images_for_work_assets.sql](/Users/kaya.matsumoto/projects/whatif/imagine/supabase/migrations/20260617_expand_user_images_for_work_assets.sql)
3. [20260617_add_default_image_work_metadata.sql](/Users/kaya.matsumoto/projects/whatif/imagine/supabase/migrations/20260617_add_default_image_work_metadata.sql)

運用上は `20260617_align_core_schema.sql` を基準にすれば足りるようにしてある。  
`expand_user_images_for_work_assets` は同日作業の一部で、内容は重複しても idempotent。

## Rollout Order

1. production に canonical migration を適用
2. staging / local にも同じ migration を適用
3. 全環境で schema 一致を確認
4. canonical schema 前提のコードを deploy
5. 暫定分岐を増やさない

## Current Recommendation

次のセッションでは、まずこの順で進める。

1. `20260617_add_default_image_work_metadata.sql` を実行
2. `default_images` 拡張列が本番に入ったことを確認
3. `Content Factory` の公式素材アップロードを実機確認
4. `user_images` は private uploads のみ返すよう UI を単純化する
