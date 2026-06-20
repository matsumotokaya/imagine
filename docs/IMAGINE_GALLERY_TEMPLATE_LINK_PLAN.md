# IMAGINE × Gallery テンプレート連携 企画 / 実装計画

最終更新: 2026-06-20
ステータス: MVP 実装着手（このドキュメントが正本。次セッションはまずこれを読む）

関連リポ:
- IMAGINE（このリポ）: `/Users/kaya.matsumoto/projects/whatif/imagine`（本番 https://app.whatif-ep.xyz, dev http://localhost:5173）
- Gallery: `/Users/kaya.matsumoto/projects/whatif/whatif-ep-xyz`（本番 https://whatif-ep.xyz, dev http://localhost:3710）
- 共有 Supabase: project ref `rgqduwojvylkulhyodqg`（両リポで同一）

関連ドキュメント:
- Gallery: `whatif-ep-xyz/docs/RENEWAL_PLAN.md`（`imagine_starter` 構想の出典）, `docs/ROADMAP.md`（「3. IMAGINE↔Gallery のつなぎ込み」が本件）
- IMAGINE: `docs/PRODUCTION_PROJECTS.md`, `docs/DATABASE.md`

---

## 1. 目的（ユーザー構想）

Gallery の各作品ページから「Edit in IMAGINE」で、その作品を **IMAGINE の編集画面で直接開く**。ユーザーはそこでクレジット（透かし/文字）の削除や、好きなサイズへの変更ができる。これが Gallery リニューアルの最後の連携ポイント。

ユーザーの本質的な要望は「単に画像URLを背景に開く」ことではなく、**Content Factory（production 系）が作った各テンプレートそのものを IMAGINE で利用可能にすること**。

- Content Factory でプロジェクトを生成すると、フィード/壁紙のテンプレートが作られ、そこからフィード画像/壁紙が出力されて Gallery に入る。
- それらテンプレートを IMAGINE 側でも **プレミアム公開テンプレート**として使える状態にする。
- Gallery 経由でなくてもアクセスでき、Gallery の該当作品にはそのテンプレへの **ダイレクトオープンリンク**を置く。
- プレミアム会員は直接編集、非会員はその手前にプレミアム動線。ゲストは非プレミアムなら編集可（premium/free のステータスが連携できていればよい。できていなければ遷移先で弾かれてよい）。
- 「ファクトリーとテンプレートは同じではない。ファクトリーで作ったらテンプレートになる流れ」が必要 = この昇格経路は現状未実装。

---

## 2. 全体設計

```
[Content Factory で生成]
production_project ─ production_project_banners(instagram_feed 等) ─ production_outputs(feed画像/壁紙)
        │ publish 操作（管理者: FactoryProjectManager）
        ▼
publishProductionProject() の中で実行:
  ① テンプレ昇格: feed banner → templates へ upsert
       (plan_type='premium', production_project_id=<project.id>)
  ② Gallery 連携: work_offers に imagine_starter offer を status='ready' で投入
       target_url = https://app.whatif-ep.xyz/banner?template=<template_id>
        ▼
[Gallery] 既存「Edit in IMAGINE」ボタンが offer.target_url を開くだけ → 自動点灯（無改修）
        ▼
[IMAGINE] /banner?template=<id> を受領 → 既存 premium ガードで会員判定
  premium会員 = 直接編集 / 非会員・free = UpgradeModal（プレミアム動線）
```

設計の妙: **Gallery 側はコードをほぼ触らない**。gallerySync が既に `work_offers` を upsert しているので、そこに `imagine_starter` offer を1件足すだけで、Gallery の既存ボタンが点灯する。

---

## 3. 調査で確定した事実（実装の根拠 / file:line）

### IMAGINE 側
- **banner→template 昇格は既に手動UIとして存在**: `src/pages/BannerEditor.tsx:1474-1512 handleTemplateModalSave` → `templateStorage.createTemplate()`（`src/.../templateStorage.ts:65-97`）。写経するフィールド = `name, elements(jsonb), canvas_color, thumbnail_url, plan_type, width, height, display_order`（`BannerEditor.tsx:1496-1505`）。banner と template はスキーマ互換性が高い（width/height は banner では `template` jsonb 内の `.width/.height`、`bannerStorage.ts:63-64`）。
- **`imagine_template` ロールは予約枠で現状未生成**: `productionProjects.ts` の `DRAFT_BANNER_SPECS` は `portrait_master / landscape_master / instagram_feed` の3つのみ。型も `Exclude<…, 'imagine_template'>`（`productionProjects.ts:26,80`）。→ MVP は **既存の `instagram_feed` banner を昇格元にする**。
- **publish の唯一の入口**: `src/.../FactoryProjectManager.tsx:226 handlePublish` → `publishProductionProject(entry)`（`src/.../productionOutputBuilder.ts:363-373`）。中身は ①`syncGalleryWorkFromProductionProject`（`gallerySync.ts:91-307`、works/work_variants/work_offers へ upsert、wallpaper offer は plan_type='premium' で作成 `:251`）→ ②delivery_package status='published' → ③project status='published'。**昇格と offer 投入は gallerySync 成功後に挿す**。
- **gallerySync は既に work_offers を upsert**: `gallerySync.ts:135-260`。`work_offer.target_ref` に project.id を入れている（`gallerySync.ts:255` 付近）。
- **templates RLS は全公開 SELECT**（`Allow public read access`, using=true）。premium 出し分けはフロントのみ（`TemplateGallery.tsx:113-169 handleTemplateClick`、ガード `:122-133`、`UpgradeModal` `:548`）。INSERT/UPDATE/DELETE は admin のみ。
- **テンプレ ダイレクトオープン**: 現状テンプレを開くのは TemplateGallery 経由のみ。`useSearchParams` は Auth/Upgrade/Callback のみで、BannerEditor は未使用。`/banner` の新規/ゲスト初期化は `location.state` 経由（`BannerEditor.tsx:263-336`）。→ `/banner` に `?template=<id>` のクエリ受け口を足し、`handleTemplateClick` 相当（`getById` ＋ premium ガード ＋ login/guest 分岐）を共通関数に切り出して再利用する。**権限ロジックの新規実装は不要**。
- **ゲスト/premium 現状挙動**: ゲスト×free テンプレ=開ける（保存は不可、`isGuest=!id` `BannerEditor.tsx:47`、ログイン誘導 `:158-161`、localStorage `GUEST_STORAGE_KEY`）。ゲスト/free×premium テンプレ=開く前に UpgradeModal で弾く（`TemplateGallery.tsx:122-133`）。premium会員×premium=`createFromTemplate`→`/banner/{id}` で編集・保存可。既存 banner の二重ガード `BannerEditor.tsx:350-356`。

### Gallery 側
- **「Edit in IMAGINE」ボタンは実装済み**: `src/app/works/[series]/[code]/page.tsx:254-267`。`imagine_starter` offer を探し（`:103-110`、variant固有→work全体の順）、`resolveOfferUrl(offer.targetUrl)`（`:35-37` 非空判定）が真ならリンク、偽なら `IMAGINE: Preparing`。**ready 条件 = imagine_starter offer が存在し target_url が非空**。現状 DB に該当行が無く全件 Preparing（`docs/ROADMAP.md:45`）。
- **モバイル版は判定が微妙に違う**: `src/components/WorkMobileInfo.tsx:199-212` は `status === "ready" && targetUrl` を要求。→ offer を `status='ready'` で投入すれば両方点灯するが、判定条件はデスクトップ/モバイルで揃える小修正を推奨。
- **work_offers スキーマ**: `whatif-ep-xyz/supabase/migrations/20260617_create_works_schema.sql:147-198`。`offer_type ∈ {wallpaper, imagine_starter, imagine_template, store_product}`、`status ∈ {ready, preparing, requested, hidden}`、`target_ref` / `target_url`、`status='ready'` なら target_ref か target_url のいずれか必須。
- **背景画像（フィード画像）URL**: `currentVariant.feedImageUrl`（`production_outputs` role=`instagram_feed` の Supabase Storage 公開URL、`whatif-ep-xyz/src/lib/wallpaper.ts:133-138` `getSeriesFeedImageMap`）。※今回の MVP は「画像URL直渡し」ではなく「テンプレ昇格 + template_id 渡し」方式なので、Gallery が背景URLを組み立てる必要はない（IMAGINE のテンプレに含まれる）。

### 連携キー
- **work 逆引き**: `templates` に work 紐付けカラムは無い。MVP は `templates.production_project_id uuid` を追加して project と1ホップで紐付ける。`work_offer.target_ref` に project.id が入っているので Gallery → project → template も辿れるが、MVP は **IMAGINE 側が publish 時に template_id を offer.target_url に焼き込む**ため Gallery 側の逆引きは不要。

---

## 4. MVP 実装スコープ

### IMAGINE リポ（`imagine`）— 改修はここに集約
1. **migration**: `templates` に `production_project_id uuid references production_projects(id)` を追加（昇格元紐付け＝再 publish 冪等キー）。`unique(production_project_id)` を付け upsert 可能に。
2. **テンプレ昇格関数**（新設、`productionOutputBuilder.ts` / `productionProjects.ts` 近辺）: 対象 project の `instagram_feed` banner を取得し、`elements / canvas_color / width / height / thumbnail_url / name` を `templates` へ upsert（`plan_type='premium'`, `production_project_id=project.id`, `is_public=true`）。写経フィールドは `handleTemplateModalSave`（`BannerEditor.tsx:1496-1505`）と同一。`createTemplate` は INSERT 専用なので upsert 化（on conflict (production_project_id)）。
3. **publish フック**: `publishProductionProject`（`productionOutputBuilder.ts:363-373`）の gallerySync 成功後に、(2) の昇格を実行し、得た template_id で `gallerySync` 側に `imagine_starter` offer を投入（`work_offers` upsert、`offer_type='imagine_starter'`, `plan_type='premium'`, `status='ready'`, `target_url='https://app.whatif-ep.xyz/banner?template=<template_id>'`）。offer のキーは work 単位（variant_id null）か variant 単位かを gallerySync の既存 wallpaper offer に合わせる。
4. **ダイレクトオープン受け口**: `/banner` の `BannerEditor` に `useSearchParams` を追加し `?template=<id>` を受ける。`handleTemplateClick`（`TemplateGallery.tsx:113-169`）の getById＋premiumガード＋login/guest 分岐を共通関数に抽出して両所で使う。`location.state` が無く `?template` がある場合のみ発火。

### Gallery リポ（`whatif-ep-xyz`）— 原則無改修
5. デスクトップ（`page.tsx:254` の target_url 非空判定）とモバイル（`WorkMobileInfo.tsx:199` の `status==='ready'` 要求）の ready 判定差を揃える小修正のみ（offer を status='ready' で入れれば両方点灯するが、条件統一が望ましい）。

---

## 5. 動作確認

- 現状 published パックは **`episode 0439-1`** の1件のみ（`docs/ROADMAP.md:18`）。これを再 publish して昇格 + offer 投入が走るか確認。
- IMAGINE: `templates` に該当行（production_project_id 付き、plan_type=premium）ができるか。`https://app.whatif-ep.xyz/banner?template=<id>`（dev は localhost:5173）で開けるか。premium会員=編集可 / 非会員=UpgradeModal。
- Gallery: `/works/episode/0439`（variant 1）の「Edit in IMAGINE」がデスクトップ/モバイルとも点灯し、上記URLへ飛ぶか。

---

## 6. 未決事項 / 次段（MVP 外）

- **壁紙テンプレの昇格**: portrait/landscape master を一般公開テンプレにするか。`WALLPAPER_FACTORY_PLAN.md:445` は「QHD 出力は一般 template で公開不要」と示唆。要判断。
- **`imagine_template` ロールを生成側で復活させるか**: 専用編集テンプレ banner を project 生成時に作る（`productionProjects.ts:32 DRAFT_BANNER_SPECS` に追加、`Exclude` 解除）か、既存 feed banner を直接昇格させ続けるか。
- **再 publish 時の更新方針**: upsert キー（production_project_id）で冪等化。テンプレ名や thumbnail の更新可否。
- **premium 判定の単一性**: templates は RLS=全公開 SELECT のため、premium テンプレの elements はゲストでも API 直叩きで取得可能（既存仕様）。秘匿が要件なら別途。
- **会員/非会員のリンク出し分け（Gallery 側）**: MVP は全員同じ URL（IMAGINE 側ガードで制御）。Gallery で手前に動線を出したくなったら後段。
- **多言語**: 壁紙 LP 同様、文言は後で EN/JA 化。
