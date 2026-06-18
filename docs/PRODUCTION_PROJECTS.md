# Production Projects

最終更新: 2026-06-19

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
- `imagine_template`
- `package_cover`（**legacy**。下記参照）

つまり、`あなたのデザイン` に見える実体はここで project と結ばれる。

> **Cover は編集バナーではない。**
> project 作成時に自動生成する下書きは `portrait_master / landscape_master / instagram_feed` の **3 点のみ**。
> `package_cover` は editor で編集する下書きとしては作らず、Publish 時に HD 壁紙からヘッドレス合成する production output として生成する（下記 Build & Publish 参照）。
> schema 上は `package_cover` role が残っているが、これは過去に作成済みプロジェクトの互換のためで、新規では draft として作られない。

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

## Build & Publish Pipeline

Content Factory の Publish ボタンは `buildProductionOutputs` → `publishProductionProject` の順で動く（`src/pages/FactoryProjectManager.tsx` の `handlePublish`）。

### 1. Output build（`src/utils/productionOutputBuilder.ts`）

master バナーの `fullres_url` を元に、次の 5 種を downscale 書き出しする。

| role | size | source banner |
| --- | --- | --- |
| `mobile_qhd` | 1440 x 2560 | portrait_master |
| `mobile_hd` | 1080 x 1920 | portrait_master |
| `pc_qhd` | 2560 x 1440 | landscape_master |
| `pc_hd` | 1920 x 1080 | landscape_master |
| `instagram_feed` | 1080 x 1350 | instagram_feed |

### 2. Cover compose（`src/utils/coverComposer.ts`）

`mobile_hd`（1080 x 1920）の壁紙を材料に、`package_cover`（1600 x 1600）を **ヘッドレス canvas2d で合成**する。

- 背景: 壁紙を cover-crop + blur
- 右: iPhone モック（`public/mocks/iphone-mock.png`、黒フレーム・透明画面）に壁紙を角丸クリップではめ込み
- 左: WHATIF / PHONE WALLPAPER PRO / EPISODE #code / 解像度スペック + アイコンの販促ブロック
- レイアウト調整用に admin 専用プレビュー `/admin/cover-lab` がある

壁紙レイアウトは人手調整が前提のため、Cover は project 作成時には作れず、HD 壁紙が確定する Publish 時にのみ生成する。

### 3. Output storage

すべての output は `user-images` バケットに保存する。

```text
user-images/{userId}/production/{projectId}/{fileName}
  ├─ mobile-qhd.png
  ├─ mobile-hd.png
  ├─ pc-qhd.png
  ├─ pc-hd.png
  ├─ instagram-feed.png
  └─ package-cover.png
```

- 先頭セグメントが `{userId}`（= `auth.uid()`）でなければ `user-images` の Storage RLS に弾かれる（`new row violates row-level security policy`）。production output も同じ規約に従う。
- output は固定ファイル名 + `upsert: true` で保存するため、再publish（同じパスの上書き）には `user-images` バケットの **UPDATE policy** が必要。これが無いと初回publish（INSERT）は通るが、再publishだけが RLS 違反になる（2026-06-19 に「先頭セグメント == auth.uid()」の UPDATE policy を追加して解決）。
- 同じ `(project_id, role)` は `is_current` を切り替えて上書きする（古い is_current=false 化 + stale storage 削除）。

### 4. Delivery package / publish

- build 完了時に `production_delivery_packages` を `status = ready` にし、`cover_output_id` に package_cover の output id を入れる。
- `production_projects.status` は build 中 `in_progress`、完了で `ready`、Publish で `published`。

### 閲覧（現状）

- 確定した output は現状 `production_outputs`（`is_current = true`）と Storage public URL から参照する。
- admin UI 上には output 専用ビューアはまだ無い（Factory ボードは編集ドラフトのみ表示）。最終的には Gallery サイトで配信・閲覧する。次の開発はこの output / delivery package を Gallery offer に接続する工程。

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
2. project 作成時に `portrait_master / landscape_master / instagram_feed` の下書きバナーを自動作成する（cover は作らない）
3. それらは admin の Content Factory 一覧に編集ドラフトとして出る
4. ただし裏では project に束ねられている
5. Publish で `mobile_qhd / mobile_hd / pc_qhd / pc_hd / instagram_feed` を build し、`package_cover` を HD 壁紙からヘッドレス合成する
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
- project 作成時に `portrait_master / landscape_master / instagram_feed` の draft banner を自動生成する（cover は作らない）
- 生成された banner を `production_project_banners` へ紐づける
- Publish で 5 種の output を build し、`package_cover` を HD 壁紙からヘッドレス合成して `production_outputs` / `production_delivery_packages` に保存する（output は `user-images/{userId}/production/{projectId}/`）

まだ入れていないもの:

- 確定 output の admin ビューア / ダウンロード導線
- zip パッケージ化
- Gallery publish 処理（offer 同期、配信 URL 発行）

次の実装は、この schema を使って

1. output / delivery package を admin と Gallery から参照できるようにする
2. package と Gallery offer を同期する

の順で進める。
