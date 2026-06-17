# Renewal Status

最終更新: 2026-06-17

## Latest Checkpoint

ここまでで到達している状態:

- `Content Factory` の admin 入口は実装済み
- `default_images` へ `series / work_number / variant_number / asset_role` を付けて公式素材を登録できる
- 公式素材から `production project` を作り、`portrait / landscape / feed / cover` の 4 種 draft banner を自動生成できる
- `あなたのデザイン` とは別に、`/mydesign/factory` で Factory 生成物を project 単位で見られる
- editor から一覧へ戻る導線は `Factory` 側と通常一覧側で分岐済み
- migration は一通り揃えたが、運用が安定したとはまだ言えない

次セッションで最初に着手する場所:

1. `thumbnail 保存不具合` の根治
2. その後に `production output build` の安定化
3. 最後に `Gallery publish / delivery` へ進む

## Current Focus

現在のリニューアル作業は、`Content Factory` の UI 追加そのものよりも、`ライブラリとDBスキーマの正規化` を優先する段階に入っている。

今やっていること:

1. `default_images` を `公式素材かつプレミアムライブラリの正規台帳` に揃える
2. `Content Factory` から `series / work_number / variant_number / asset_role` を付けて素材を直接登録できるようにする
3. `banners` / `default_images` / `templates` / `user_images` まわりの本番スキーマ不整合を解消する

## Why This Is First

現状の一番大きい負債は、機能不足よりも `コードが前提にしているスキーマ` と `本番DBの実スキーマ` がずれること。

実際に起きた問題:

- `banners.fullres_url` を前提にしたコードが、本番DBには列が無いため壊れた
- 一覧取得と autosave が止まり、`あなたのデザイン` が空に見えた

これは UI の問題ではなく、`migration 管理の不統一` の問題。

## Active Track

次セッションで最初に再開すべきトラックはこれ。

### Track 1: Canonical schema definition

対象:

- `banners`
- `templates`
- `user_images`
- `default_images`
- 関連RLS
- 関連RPC / trigger

やること:

1. 現在の production schema を実測する
2. コードが必要としている列・制約・関数を列挙する
3. あるべき canonical schema を定義する
4. それに揃える migration を作る

### Track 2: Library normalization

対象:

- `default_images` へ作品 metadata を追加
- `user_images` を private upload layer に戻す
- `Content Factory` の公式素材アップロード
- editor 側ライブラリとの整合

やること:

1. 公式素材を `default_images` へ直接保存する
2. `default_images = premium asset registry` を前提にする
3. `user_images = private uploads` を前提に UI を単純化する
4. `works` 側の `series / code / variant` と結びつける

### Track 3: Compatibility cleanup

現時点の状況:

- `banners.fullres_url` 欠落に対する一時フォールバックは削除済み
- 以後は canonical schema 前提で運用する

方針:

- 今後も暫定分岐を増やさない
- 足りない列や制約は migration で揃える

## Priority Order

今後の開発効率を最大化するため、優先順位は以下。

1. `thumbnail 保存不具合` の根治
2. `DB schema / migration / RLS / RPC` の最終確認
3. schema を前提にしたコードの単純化
4. ライブラリの正規化
5. Content Factory の production project 化
6. wallpaper build / Gallery publish

## Current Blocker

未解決の重要課題:

- 画像を編集して保存しても、banner の thumbnail が更新されない
- 特に `Content Factory` 一覧では、編集後もサムネイルが古いまま、または未保存のまま見える
- 一部では `cover` 系 banner に thumbnail / fullres が保存されていないケースもある

認識:

- いったん `invalidate` や fallback の調整は入れたが、根本解決には至っていない
- つまり、次セッションは新機能追加ではなく、まず `保存時に thumbnail が本当に生成・保存されるか` を追うべき
- 入口は `BannerEditor -> performSave(true) -> batchSave() -> storage upload -> banners.thumbnail_url 更新` の経路

## Definition Of Done For This Debt Phase

次の状態になったら、負債整理フェーズは一段落とみなす。

1. 本番とローカルで `banners`, `default_images`, `user_images`, `templates` の必須列が一致する
2. 互換フォールバック無しで正常動作する
3. `Content Factory` の素材アップロードが `default_images` 前提で安定する
4. 次の機能開発で `まずDBが合っているか確認する` 作業が不要になる

## Notes For Next Session

- いまの主題は `壁紙機能追加` そのものではなく、まず `thumbnail 保存不具合の解消`
- `Content Factory` は入口、素材 upload、project 作成、4 種 draft banner 自動生成まで到達済み
- `Factory project` 一覧 UI もあるが、thumbnail が更新されないため運用上まだ不安定
- 再開地点は `BannerEditor` の保存経路と `banners.thumbnail_url / fullres_url` の実データ確認から
- thumbnail 問題が解消したら、次は `production_outputs` の build と package / Gallery publish に進む
- `fullres_url` 問題のような不整合を再発させないことが最優先
