# Renewal Status

最終更新: 2026-06-19

## Latest Checkpoint

到達している状態:

- **スキーマ整合フェーズは完了**（SCHEMA_ALIGNMENT.md 参照）。本番 / ローカルが canonical schema に一致し、互換フォールバック無しで動作する。
- `banners.fullres_url` 欠落問題は解消。`thumbnail_data_url`（レガシー Base64 列）はコード参照撤去 + 列 DROP まで完了。
- **thumbnail 保存不具合は解消**（編集後にサムネイルが更新される認識）。
- **Content Factory の publish 失敗（`new row violates row-level security policy`）を根治**。真因は `user-images` バケットに UPDATE policy が無く、固定パス + `upsert: true` の production output 上書き（再publish）が弾かれていたこと。UPDATE policy 追加で解決。応急で入れた service_role バイパスは撤去済み。
- Content Factory: 公式素材登録 → project 作成 → portrait / landscape / feed の draft 自動生成 → publish（5 PNG + `package_cover` 合成）→ ready / published まで動作。

## Current Focus

負債整理フェーズは一段落。今後は機能側へ進む:

1. production output build の安定化（再publish / 上書きを含む実運用確認）
2. Gallery publish / delivery package の整備
3. wallpaper 配信フロー

## Resolved（主要な解決済み課題）

- スキーマ不整合（`fullres_url` 欠落など）
- thumbnail 保存不具合
- Content Factory publish の RLS 違反
- レガシー `thumbnail_data_url` の除去（コード + DB列）

## Principles（継続）

- 根本原因を追求し、バイパス / フォールバック / 暫定分岐で問題を覆い隠さない。
- 足りない列・制約・ポリシーは migration で揃える。暫定分岐を増やさない。
- 「固定パス + `upsert: true`」で Storage 保存する箇所は、対象バケットの UPDATE policy 依存に注意する。

## Notes For Next Session

- 再開地点は `production output build` の実運用確認、その後 `Gallery publish / delivery`。
- DB は canonical 一致済みなので「まず DB が合っているか確認する」作業は不要。
