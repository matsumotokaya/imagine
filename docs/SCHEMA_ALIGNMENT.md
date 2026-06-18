# Schema Alignment

最終更新: 2026-06-19

## Status: 完了

`コードが前提にするスキーマ` と `本番の実スキーマ` の不一致解消フェーズは完了。
2026-06-19 時点で本番 / ローカルとも canonical schema に一致しており、互換フォールバック無しで動作する。

## Purpose

`imagine` の開発効率を上げるため、コードが前提にするスキーマと各環境の実スキーマを一致させる。
この資料は、適用済みの canonical schema と migration の記録を一箇所にまとめる。

## 適用済み Canonical Schema（本番反映確認済み）

### `banners`
- `fullres_url` 追加済み（当初欠落により一覧取得と autosave が `column banners.fullres_url does not exist` で壊れた問題は解消）
- `is_public` / `display_order` / `template_id` あり
- `thumbnail_data_url`（レガシー Base64 列）は全行0件移行のうえ **削除済み**（2026-06-19）

### `templates`
- `display_order` / `width` / `height` / `like_count` / `open_count` あり

### `user_images`
- `asset_scope` / `source_context` / `work_series_slug` / `work_number` / `variant_number` / `asset_role` / `tags` / `notes` あり
- 用途は **private uploads のみ**（公式素材台帳にはしない）

### `default_images`
- `source_context` / `work_series_slug` / `work_number` / `variant_number` / `asset_role` / `tags` / `notes` あり
- **公式素材かつプレミアムアセットの正規台帳**

### Production tables
- `production_projects` / `production_project_assets` / `production_project_banners` / `production_outputs` / `production_delivery_packages` 稼働中（詳細は DATABASE.md）

### Storage RLS
- `user-images` バケットは SELECT / INSERT / UPDATE / DELETE を「パス第1セグメント == `auth.uid()`」で許可
- UPDATE は production output（固定パス + `upsert: true`）の再publish上書きに必須（2026-06-19 追加）

## 適用済み migration

1. `20260617_align_core_schema.sql`
2. `20260617_expand_user_images_for_work_assets.sql`
3. `20260617_add_default_image_work_metadata.sql`
4. `user-images` バケットへ UPDATE policy 追加（2026-06-19）
5. `banners.thumbnail_data_url` 列 DROP（2026-06-19）

## 方針（継続）

- 互換フォールバック / 暫定分岐を増やさない。足りない列・制約・ポリシーは migration で揃える。
- 新しく「固定パス + `upsert: true`」で Storage 保存する場合、対象バケットに UPDATE policy が要る点に注意。
