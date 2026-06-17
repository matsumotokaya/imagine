# Production Projects

最終更新: 2026-06-17

## Purpose

Content Factory で扱う制作単位を定義する。

ここでの結論は単純で、

- `1 production project = 1 series / 1 work / 1 variant`
- 同じ作品の枝番をまとめて見たいときは、`series + work_number` で project 群を取る

という構造にする。

## Why This Shape

必要な切り方は 2 つある。

1. 最小単位としての `variant package`
   - 例: `episode / 0465 / 1`
   - この 1 つに対して feed, wallpaper, cover, template を対応させる

2. 同じ作品単位としての `work grouping`
   - 例: `episode / 0465`
   - その中に `0465-1`, `0465-2`, `0465-3` がある

この 2 つを両立するために、IMAGINE 側では `variant` を project の主キーにし、`work` は query で束ねる。

つまり、余計な中間階層は増やさない。

## Separation Of Concerns

作品の正本と、制作の正本は別物。

### Gallery / WHATIF side

- `series`
- `work`
- `variant`

これは公開作品の正本。

### IMAGINE / Content Factory side

- `production_project`
- `project_assets`
- `project_banners`
- `project_outputs`
- `delivery_package`

これは制作と配布の正本。

IMAGINE 側で `works` をもう一度完全複製しない理由は、Gallery 側にすでに作品階層があるから。
IMAGINE 側は、その階層と同じ自然キーを持てば足りる。

## Canonical Hierarchy

```text
series
  -> work
    -> variant
      -> production_project
        -> production_project_assets
        -> production_project_banners
        -> production_outputs
        -> production_delivery_package
```

重要なのは、`production_project` 自体が variant 単位だということ。

## Canonical Keys

project を一意に識別するキー:

- `work_series_slug`
- `work_number`
- `variant_number`

補助表示用:

- `work_display_code`

このため、1 project は例えば次のようになる。

- `episode / 465 / 1`
- `reel / 12 / 3`
- `remix / 31 / 2`

## Table Roles

### `production_projects`

1 行 = 1 variant package。

持つもの:

- どのシリーズか
- どの作品番号か
- どの枝番か
- 今どの工程にいるか

### `production_project_assets`

project に紐づく公式素材。

参照先:

- `default_images`

役割例:

- `source`
- `main_character`
- `sub_character`
- `background`
- `logo`
- `reference`

### `production_project_banners`

project に紐づく、実際に editor で開いて直すバナー。

参照先:

- `banners`

役割例:

- `portrait_master`
- `landscape_master`
- `instagram_feed`
- `package_cover`
- `imagine_template`

つまり、`あなたのデザイン` に見える実体はここで project と結ばれる。

### `production_outputs`

build によって生成される最終ファイル。

役割例:

- `mobile_qhd`
- `mobile_hd`
- `pc_qhd`
- `pc_hd`
- `instagram_feed`
- `package_cover`
- `zip`

### `production_delivery_packages`

販売・配布の単位。

project 1 件に対して package 1 件を基本とする。

持つもの:

- 価格
- サブスク対象か
- 公開状態
- Gallery 側 offer との参照キー

## Query Patterns

### 1. Variant package を 1 件開く

```sql
select *
from public.production_projects
where work_series_slug = 'episode'
  and work_number = 465
  and variant_number = 1;
```

### 2. 同じ episode 配下の枝番を一覧する

```sql
select *
from public.production_projects
where work_series_slug = 'episode'
  and work_number = 465
order by variant_number asc;
```

### 3. 1 project の編集用バナーを取る

```sql
select ppb.*, b.*
from public.production_project_banners ppb
join public.banners b on b.id = ppb.banner_id
where ppb.project_id = :project_id
  and ppb.is_active = true
order by ppb.sort_order asc;
```

## What This Enables

この構造にすると、次が自然にできる。

1. `default_images` の素材から project を作る
2. project 作成時に `portrait_master / landscape_master / feed / cover` の下書きバナーを自動作成する
3. それらは admin の `あなたのデザイン` 一覧に普通のバナーとして出る
4. ただし裏では project に束ねられている
5. 後から `mobile_qhd / pc_hd / zip` などの build 成果物を追加できる
6. Gallery 側には `series / work_number / variant_number` で offer を結び直せる

## Scope Of The Current Migration

今回の migration で入れたのは、まず土台だけ。

- `production_projects`
- `production_project_assets`
- `production_project_banners`
- `production_outputs`
- `production_delivery_packages`

実装済み:

- Content Factory から `default_images` を起点に project を作る
- project 作成時に `portrait_master / landscape_master / instagram_feed / package_cover` の draft banner を自動生成する
- 生成された banner を `production_project_banners` へ紐づける

まだ入れていないもの:

- output build 処理
- Gallery publish 処理

次の実装は、この schema を使って

1. `production_outputs` を build する
2. package と Gallery offer を同期する

の順で進める。
