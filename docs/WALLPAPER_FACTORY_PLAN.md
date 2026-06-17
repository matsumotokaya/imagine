# IMAGINE Wallpaper Factory Plan

最終更新: 2026-06-17

## Goal

IMAGINE を `ユーザー向けデザインエディタ` から、WHATIF 公式作品の `制作工場` としても機能する構造に拡張する。

対象:

- Instagram feed
- Mobile wallpaper
- PC wallpaper
- Package cover

狙い:

1. 同じ作品を何度も別サイズで手作業制作しない
2. `character asset -> master design -> derived outputs` の流れを固定する
3. Gallery / wallpaper / IMAGINE template を同じ元データから派生させる

## Product Direction

IMAGINE には、通常ユーザー向けの editor / library / banner 管理とは別に、`admin 専用の Content Factory` を持たせる。

初期実装:

- admin 画面の入口として `/admin/content-factory` を追加
- まずは workflow の可視化と運用ルールの固定を担当
- DB / storage / build queue 連携は次段階で実装

役割:

- `通常ユーザーUI`
  - 自分の作品を作る
  - テンプレートを使う
  - ライブラリを使う
- `Content Factory`
  - WHATIF 公式作品を量産する
  - `work / variant` と素材を結びつける
  - 壁紙 pack を生成する
  - Gallery へ publish する

重要なのは、公式制作フローを一般ユーザーの導線に混ぜないこと。

## Immediate Decision

HD と QHD を別々の編集データとして持たない。  
編集の正本は QHD 側だけに寄せ、HD は派生出力で作る。

ただし、縦と横は別構図になりやすいので、正本は 1 個ではなく 2 系統と考える。

### Canonical masters

1. Portrait master
- 用途: mobile wallpaper, Instagram feed
- 推奨正本サイズ: `1440 x 2560` PNG

2. Landscape master
- 用途: PC wallpaper
- 推奨正本サイズ: `2560 x 1440` PNG

この 2 つを QHD 正本として持ち、HD は自動で半分にする。

### Derived outputs

1. Mobile QHD
- `1440 x 2560`

2. Mobile HD
- `1080 x 1920`

3. PC QHD
- `2560 x 1440`

4. PC HD
- `1920 x 1080`

5. Instagram feed
- `1080 x 1350`

6. Package cover
- `1600 x 1600` か `1800 x 1800`

## Why two masters are necessary

`Instagram feed 1080x1350` と `mobile wallpaper 1440x2560` は縦でもアスペクト比が違う。  
`PC wallpaper 2560x1440` はさらに別物。

つまり:

- `1 master -> すべて自動生成`

は理想だが、初期品質は下がりやすい。  
まずは現実的に次の構造にする。

- `portrait master`
  - mobile QHD の正本
  - Instagram feed は safe area を前提に crop 生成
- `landscape master`
  - PC QHD の正本
  - PC HD は downscale 生成

## What IMAGINE needs first

IMAGINE に最初に必要なのは 6 項目。

その前提として、`Content Factory` のワークフローを固定する必要がある。

## Content Factory workflow

最初の起点は `work variant` の更新。

例:

- `episode 0500`
- `variant 1`

基本フロー:

1. Content Factory で対象 `work / variant` を選ぶ
2. キャラクター PNG をアップロードする
3. そのアップロードは `episode 0500-1 の公式素材` として保存される
4. システムが下書き project を作る
5. その project から `portrait master` `landscape master` `feed` `cover` の起点を作る
6. Human in the Loop で editor へ入り、背景色や構図を調整する
7. 保存後、必要な出力を build する
8. package 完成後、Gallery 側へ publish する

## Admin Content Factory UI

管理画面は、パイプラインが見える UI にした方がよい。

最低限必要な画面ブロック:

### 1. Work selector

- `series`
- `display_code`
- `variant_number`

### 2. Character asset panel

- 対象キャラクター PNG をアップロード
- すでに登録済みの素材一覧
- `main character` / `sub character` / `logo`

### 3. Pipeline status board

視覚的に工程を並べる。

例:

```text
Character Asset
  -> Portrait Master
  -> Landscape Master
  -> Feed Output
  -> Wallpaper Outputs
  -> Cover
  -> ZIP Package
  -> Gallery Publish
```

各ステップの状態:

- `missing`
- `draft`
- `ready`
- `published`
- `failed`

### 4. Edit entrypoints

各工程から editor を開けるようにする。

例:

- `Edit portrait master`
- `Edit landscape master`
- `Edit feed`
- `Edit cover`

### 5. Output panel

現在の生成物を一覧表示する。

- mobile HD
- mobile QHD
- pc HD
- pc QHD
- feed
- cover
- zip

### 6. Publish panel

- Gallery に publish
- `Preparing -> Ready`
- 単品販売 / サブスク対象の切替

### 1. Character assets as first-class data

キャラクター切り抜き PNG を、単なる画像アップロードではなく `公式制作素材` として持つ必要がある。

最低限必要な情報:

- `work_series_slug`
- `work_display_code`
- `variant_number`
- `asset_type` = `character_cutout`
- `storage_path`
- `width`
- `height`
- `tags`

重要なのは、`episode 0100-5 のキャラクター素材` だと分かること。

初期実装では `user_images` を拡張し、`asset_scope = official` と作品 metadata でこの役割を持たせる。

### 2. Production projects

IMAGINE 上での「制作案件」を持つ。

1 つの project が 1 つの `work variant` に対応する。

例:

- `episode / 0100 / variant 5`

project が持つもの:

- portrait master の banner id
- landscape master の banner id
- source character asset ids
- status

この project が `Content Factory` の UI 上の 1 行になる。

### 3. Output recipes

サイズ別派生生成のルールをデータとして持つ。

必要な recipe:

- `portrait_master`
- `mobile_qhd`
- `mobile_hd`
- `instagram_feed`
- `landscape_master`
- `pc_qhd`
- `pc_hd`
- `package_cover`

recipe が持つ情報:

- 出力サイズ
- crop mode
- safe area
- downscale rule
- cover layout rule

### 4. Derived output storage

生成物の保存先を `banners` と切り離す。

理由:

- `banners` はユーザー編集物の置き場
- 壁紙 pack は販売物 / 配布物
- 運用目的が違う

推奨:

- editable master: IMAGINE 側 DB + Storage
- final outputs / zip / cover: R2

特に QHD PNG は重いので、配布系の保存先は `R2` に寄せた方が合理的。

### 5. Safe area overlays

portrait master から Instagram feed を切り出すなら、最初から safe area が必要。

最低限必要な overlay:

- mobile wallpaper safe area
- Instagram feed crop area
- PC wallpaper composition area

これがないと `1回作って使い回す` が成立しない。

### 6. Official production UI

通常ユーザー向け UI とは別に、admin 用の production workflow が必要。

最低限ほしい画面:

1. `character asset` 登録
2. `production project` 作成
3. portrait master / landscape master の紐付け
4. export 実行
5. output 一覧
6. Gallery へ publish

## Human in the Loop

ここは完全自動化しない前提でよい。

想定:

1. character asset を入れる
2. 下書き project ができる
3. admin が editor で背景色、配置、文字を調整する
4. 保存する
5. build する

つまり:

- 自動生成は `下書きのたたき台`
- 品質を決めるのは人間

## Save policy

ここが今回の一番重要な設計ポイント。

結論:

- **通常の保存では HD / QHD / ZIP を都度生成しない**
- 通常保存は `editable state + 軽量 preview` だけにする
- 重い出力は `Build outputs` または `Publish package` のタイミングでだけ生成する

これを分けないと、容量も処理時間も破綻する。

### Working save

通常の editor 保存。

保存対象:

- elements JSON
- template / canvas metadata
- low-res preview JPEG

保存しないもの:

- mobile HD PNG
- mobile QHD PNG
- pc HD PNG
- pc QHD PNG
- zip

### Build outputs

admin が明示的に押したときだけ重い出力を作る。

生成対象:

- mobile HD
- mobile QHD
- pc HD
- pc QHD
- feed
- cover

この出力は最新 build を上書きしてよい。

### Publish package

公開確定時の処理。

このタイミングで:

- 最終出力を確定
- zip を生成
- cover を確定
- Gallery へ publish

必要ならここでだけ version を切る。

## Draft outputs vs published outputs

生成物は 2 種類に分ける。

### Draft outputs

- 最新の作業用
- 上書きでよい
- 再 build で置き換える

### Published outputs

- 実際にユーザーへ配るもの
- immutable に近い扱い
- package 単位で固定する

この区別を入れると、保存のたびに PNG が増殖する問題を避けられる。

## Storage recommendation

QHD PNG は容量が重いので、保存先の役割を分けるべき。

### Keep in IMAGINE-side storage

- character cutout PNG
- editable master preview
- banner JSON / elements
- admin working files

補足:

- `portrait master` と `landscape master` の編集状態は IMAGINE 側 DB に残す
- preview は JPEG でよい
- heavy PNG を通常保存のたびに作らない

### Keep in R2

- final mobile QHD
- final mobile HD
- final PC QHD
- final PC HD
- package cover
- zip package

理由:

- download traffic を Gallery 側に寄せやすい
- 今の WHATIF 配信構造と揃う
- 大きいファイルの配布に向く

## Why private factory projects are acceptable

壁紙サイズや QHD 出力は一般ユーザー向け template として公開する必要はない。

むしろ最初は:

- admin だけが触る
- project は非公開
- Gallery publish した成果物だけ公開

にした方が自然。

つまり、`wallpaper production project` は `自分だけのアートワーク` でよい。

一般ユーザー向けテンプレート化は、その後で反応の良いものだけに絞ればよい。

## Recommended data model for IMAGINE

### `official_assets`

公式素材の正本。

```sql
id uuid primary key
asset_type text not null            -- character_cutout / background / logo
name text not null
work_series_slug text
work_display_code text
variant_number integer
storage_path text not null
width integer
height integer
tags text[]
created_at timestamptz
updated_at timestamptz
```

### `production_projects`

制作案件。

```sql
id uuid primary key
project_type text not null          -- wallpaper_pack
work_series_slug text not null
work_display_code text not null
variant_number integer not null
portrait_banner_id uuid
landscape_banner_id uuid
status text not null                -- draft / ready / published
created_at timestamptz
updated_at timestamptz
```

### `production_project_assets`

project に使う素材紐付け。

```sql
project_id uuid not null
official_asset_id uuid not null
role text not null                  -- main_character / sub_character / logo
primary key (project_id, official_asset_id)
```

### `production_output_recipes`

出力ルール。

```sql
id uuid primary key
recipe_key text unique not null     -- mobile_hd / pc_qhd / instagram_feed
source_master text not null         -- portrait / landscape
output_width integer not null
output_height integer not null
crop_mode text not null             -- fit / cover / safe_area_crop / downscale
safe_area_json jsonb
is_active boolean not null default true
```

### `production_outputs`

派生生成ファイル。

```sql
id uuid primary key
project_id uuid not null references production_projects(id)
recipe_key text not null
storage_path text not null
mime_type text not null
file_size_bytes bigint
width integer not null
height integer not null
status text not null                -- ready / preparing / failed
created_at timestamptz
updated_at timestamptz
```

### `delivery_packages`

配布単位。

```sql
id uuid primary key
project_id uuid not null references production_projects(id)
cover_output_id uuid
zip_storage_path text
status text not null                -- draft / ready / published
price_usd numeric(10,2)
is_subscription_included boolean not null default true
created_at timestamptz
updated_at timestamptz
```

## Practical first workflow

自動化前の最初の運用はこれでよい。

1. キャラクター PNG を `official_assets` 相当の置き場へ入れる
2. `production_project` を作る
3. portrait master を IMAGINE で作る
4. landscape master を IMAGINE で作る
5. 通常保存では JSON + preview だけ保存する
6. `Build outputs` で QHD と feed と cover を生成する
7. HD は downscale 生成する
8. zip を作る
9. Gallery の `wallpaper` offer に紐づける

## What can be automated later

後で自動化しやすい部分:

- HD 生成
- feed crop 生成
- package cover 生成
- zip 生成
- Gallery publish

後でも人手が残りやすい部分:

- portrait / landscape の構図決定
- キャラクター切り抜き品質確認
- 作品タイトルや見せ方の最終判断

## Immediate next implementation tasks

IMAGINE 側で最初にやるべき準備はこの順。

1. `official_assets` 相当の公式素材置き場を作る
2. admin 用 `Content Factory` 画面を作る
3. `production_projects` を作る
4. `portrait master` / `landscape master` を project に紐づけられるようにする
5. `working save` と `build outputs` を分離する
6. `recipe` 定義を作る
7. `QHD -> HD downscale` の export 処理を作る
8. `production_outputs` と `delivery_packages` を作る

## Design principle

今後の制作単位は:

- `character asset`
- `master design`
- `derived outputs`
- `delivery package`

の 4 つに分ける。

これを混ぜないこと。  
ここを分けるだけで、壁紙制作、Gallery 連携、IMAGINE テンプレ化がすべて整理される。
