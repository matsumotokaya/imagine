# Release Checklist - IMAGINE v1.0

Last updated: 2026-02-14

---

## Overview

IMAGINE を本番公開するためのリリースチェックリスト。
Stripe本番切り替え、テンプレート/ライブラリ充実、テスト検証、既知の制限事項を網羅する。

---

## 1. Stripe: サンドボックス → 本番切り替え

### 1-1. Stripe管理画面での作業

- [ ] **Liveモードに切り替え**（Stripe Dashboard 右上のトグル）
- [ ] **本番用の商品・価格を作成**
  - Products > Add product
  - 名前: `IMAGINE Premium`
  - 価格: Recurring / Monthly / $3.00
  - 作成後、**Price ID**（`price_live_xxx`）をコピー
- [ ] **本番用Webhookエンドポイントを作成**
  - Developers > Webhooks > Add endpoint
  - URL: `https://rgqduwojvylkulhyodqg.supabase.co/functions/v1/stripe-webhook`
  - Events:
    - `checkout.session.completed`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
  - 作成後、**Signing Secret**（`whsec_xxx`）をコピー
- [ ] **本番用APIキーを取得**
  - Developers > API keys（Liveモード）
  - **Publishable key**（`pk_live_xxx`）をコピー
  - **Secret key**（`sk_live_xxx`）をコピー

### 1-2. Vercel環境変数の更新

Project Settings > Environment Variables で以下を**本番値に更新**:

| 変数名 | 旧値（テスト） | 新値（本番） |
|--------|---------------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_xxx` | `pk_live_xxx` |
| `VITE_STRIPE_PRICE_ID` | `price_test_xxx` | `price_live_xxx` |

### 1-3. Supabase Edge Functions Secretsの更新

Settings > Edge Functions > Edge Function Secrets で以下を更新:

| Secret名 | 旧値（テスト） | 新値（本番） |
|----------|---------------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_xxx` | `sk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_test_xxx` | `whsec_live_xxx` |

### 1-4. Edge Functionsの再デプロイ

Secrets更新後、Edge Functionsを再デプロイ:

```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
```

### 1-5. 本番決済テスト

- [ ] 実際のカードで $3.00 の決済が通ることを確認
- [ ] `profiles` テーブルで `subscription_tier = 'premium'` に更新されることを確認
- [ ] Billing Portal（サブスク管理画面）が開くことを確認
- [ ] キャンセルフローが正常に動作することを確認（`subscription_status` が `canceling` → `canceled` に遷移）
- [ ] テスト決済はStripe管理画面から手動で返金処理する

---

## 2. テンプレート・ライブラリの充実

### 2-1. テンプレートの追加

現状のテンプレートはデフォルト3個 + DB登録分。公開に向けて以下を準備:

- [ ] **サイズカテゴリごとに最低3テンプレートを用意**
  - Instagram Post (1080×1080)
  - Instagram Story (1080×1920)
  - YouTube Thumbnail (1280×720)
  - X/Twitter Header (1500×500)
  - その他需要のあるサイズ
- [ ] **Free / Premium の振り分け**
  - Free: 各カテゴリ最低1つ
  - Premium: 高品質・多機能なテンプレート
- [ ] **テンプレートのサムネイル画像**を用意
- [ ] **display_order** を設定してギャラリーの表示順を最適化

### 2-2. デフォルト画像ライブラリ

- [ ] 商用利用可能な素材を `default-images` バケットにアップロード
- [ ] カテゴリ分けのためのタグ付け（`tags` カラム）
- [ ] 最低限のジャンル: 背景、フレーム、装飾、アイコン

### 2-3. デモキャンバス（DemoCanvas）の更新

- [ ] トップページのデモ表示を最新テンプレートに合わせて更新
- [ ] デモ用の画像URLが有効であることを確認

---

## 3. リリース前テスト項目

### 3-1. 認証テスト

| テスト項目 | 確認方法 | 合否 |
|-----------|---------|------|
| Google OAuth ログイン | Google アカウントでログイン → プロフィール作成確認 | [ ] |
| Apple Sign In | Apple ID でログイン → プロフィール作成確認 | [ ] |
| Email/Password 新規登録 | メールアドレスで登録 → 確認メール受信 → ログイン | [ ] |
| Email/Password ログイン | 既存アカウントでログイン | [ ] |
| パスワードリセット | リセットメール送信 → 新パスワード設定 | [ ] |
| ログアウト | ログアウト → セッションクリア確認 | [ ] |
| ゲストモード | 未ログインでバナー作成 → localStorage保存確認 | [ ] |
| ゲスト → ログイン遷移 | ゲストバナー作成後、ログイン → データ引き継ぎ確認 | [ ] |

### 3-2. 決済テスト（本番キー設定後）

| テスト項目 | 確認方法 | 合否 |
|-----------|---------|------|
| Premiumアップグレード | UpgradeModal → Stripe Checkout → 決済完了 | [ ] |
| 決済後リダイレクト | `/success` ページに遷移 → 5秒後にリダイレクト | [ ] |
| profiles更新 | `subscription_tier` = `premium`、`subscription_status` = `active` | [ ] |
| Premium機能解放 | 画像ライブラリ、Premiumテンプレートにアクセス可能 | [ ] |
| Billing Portal | MyPage → サブスク管理 → Stripe Portal表示 | [ ] |
| サブスクキャンセル | Portal でキャンセル → `subscription_status` = `canceling` | [ ] |
| 期間終了後のダウングレード | Webhook: `subscription.deleted` → `subscription_tier` = `free` | [ ] |

### 3-3. エディタ機能テスト

| テスト項目 | 確認方法 | 合否 |
|-----------|---------|------|
| テキスト追加・編集 | フォント、サイズ、色、太さ、行間、字間 | [ ] |
| 図形追加 | 矩形、円、三角形、星、ハート + 塗り/線 | [ ] |
| 画像追加 | アップロード → キャンバスに配置 → リサイズ/回転 | [ ] |
| シャドウエフェクト | ぼかし、オフセット、透明度、色 | [ ] |
| 複数選択 | Shift+Click → グループ移動/変形 | [ ] |
| Undo/Redo | Cmd+Z / Cmd+Y が正常に動作 | [ ] |
| Copy/Paste | Cmd+C / Cmd+V でエレメント複製 | [ ] |
| レイヤー操作 | 前面/背面移動、ロック、表示/非表示 | [ ] |
| ズーム/パン | トラックパッド/マウスホイール/ボタン | [ ] |
| 自動保存 | 3秒デバウンス → DBに保存 → ステータス表示 | [ ] |

### 3-4. エクスポートテスト

| テスト項目 | 確認方法 | 合否 |
|-----------|---------|------|
| PNG エクスポート | オリジナル解像度でダウンロード | [ ] |
| サムネイル生成 | 400px JPEG 70%品質 → 正常に表示 | [ ] |
| 画像付きバナーのエクスポート | 外部画像が含まれるバナーが正常にエクスポートされる | [ ] |

### 3-5. データ永続化テスト

| テスト項目 | 確認方法 | 合否 |
|-----------|---------|------|
| バナー作成 | 新規バナー → DB保存確認 | [ ] |
| バナー編集 | 要素変更 → 自動保存 → リロード後復元 | [ ] |
| バナー複製 | 複製 → 元バナーと独立して編集可能 | [ ] |
| バナー削除 | 削除 → DBから消去確認 | [ ] |
| テンプレートからバナー作成 | テンプレート選択 → 新規バナー生成 | [ ] |
| 画像ライブラリ | アップロード → ライブラリに表示 → キャンバスに配置 | [ ] |

### 3-6. i18n テスト

現在対応済みの言語: English, Japanese, Simplified Chinese, Traditional Chinese, Korean

| テスト項目 | 確認方法 | 合否 |
|-----------|---------|------|
| 言語切り替え | LanguageSwitcher で全言語に切り替え | [ ] |
| 翻訳欠落なし | 各言語で全画面を確認、未翻訳キーがないこと | [ ] |
| フォント表示 | CJK文字が正常に表示されること | [ ] |
| 言語記憶 | 選択言語がリロード後も保持されること（localStorage） | [ ] |
| 法的ページ | 利用規約・プライバシーポリシー等が各言語で表示 | [ ] |

### 3-7. セキュリティテスト

| テスト項目 | 確認方法 | 合否 |
|-----------|---------|------|
| RLS ポリシー | 他ユーザーのバナーにアクセスできないこと | [ ] |
| RLS ポリシー | 他ユーザーの画像にアクセスできないこと | [ ] |
| Admin権限 | 一般ユーザーがAdmin操作（テンプレート管理等）できないこと | [ ] |
| CORS設定 | 許可されたオリジンのみAPIアクセス可能 | [ ] |
| 環境変数 | Secret key がフロントエンドに露出していないこと | [ ] |
| Webhook署名 | 不正なWebhookリクエストが拒否されること | [ ] |

---

## 4. 既知の制限事項と妥協点

### 4-1. モバイル対応

**方針: PC版の利用を推奨、モバイルは閲覧・簡易操作のみ**

| 制限事項 | 影響 | 対応策 |
|---------|------|--------|
| キャンバス操作がタッチで困難 | エレメントの精密な配置・変形が難しい | `DesktopRecommendedModal` で PC利用を案内 |
| Shift+Click 複数選択不可 | タッチデバイスではキーボード併用不可 | モバイルツールバーで代替操作を提供 |
| ピンチズームなし | トラックパッドのピンチのみ対応 | ズームボタン（+/-）で対応 |
| キーボードショートカット不可 | Undo/Redo、Copy/Paste等 | モバイルツールバーのボタンで対応 |
| PropertyPanel が狭い | max-height: 20vh の底部ドロワー | 最低限のプロパティのみ表示 |

**DesktopRecommendedModal の動作:**
- `window.innerWidth < 768` で表示
- 「次回から表示しない」チェックボックスで dismiss 可能
- localStorage (`imagine_desktop_modal_dismissed`) に記憶

### 4-2. 既知のバグ・未実装機能

| 項目 | ステータス | 影響度 | リリースへの影響 |
|------|-----------|--------|----------------|
| サムネイル白化問題 | 既知・自動復旧 | 低 | リリース可（見た目だけの問題、次回保存で復旧） |
| Lasso Selection | 開発中 | 低 | リリース可（Shift+Click で代替可能） |
| 外側線エフェクト | 未実装 | 低 | リリース可（将来実装予定） |
| グロー/グラデーション | 未実装 | 低 | リリース可（将来実装予定） |
| Error Boundary | 未実装 | 中 | 推奨: リリース前に追加を検討 |
| Sentry等のエラー監視 | 未導入 | 中 | 推奨: リリース後早期に導入 |

### 4-3. パフォーマンスの妥協点

| 項目 | 現状 | 備考 |
|------|------|------|
| React StrictMode | 無効化 | 重複クエリ（4-5x）を防ぐため意図的に無効化 |
| サムネイル生成タイミング | ページ離脱時のみ | 毎回保存時に生成するとStorage egress 95%増加 |
| Realtime Rate Limit | 10 events/sec | Supabase負荷軽減のため |

---

## 5. インフラ・環境の最終確認

### 5-1. Vercel

- [ ] カスタムドメイン (`app.whatif-ep.xyz`) が正常にアクセス可能
- [ ] HTTPS 証明書が有効
- [ ] `vercel.json` の SPA リライト設定が正しく動作
- [ ] 環境変数がすべて Production に設定されている

### 5-2. Supabase

- [ ] プロジェクトがアクティブ状態
- [ ] RLS ポリシーが全テーブルで有効
- [ ] Storage バケット（`default-images`, `user-images`, `thumbnails`）のアクセスポリシー確認
- [ ] Edge Functions が正常にデプロイ済み
- [ ] リダイレクト URL に本番ドメインが登録済み

### 5-3. Apple Sign In

- [ ] Secret Key の有効期限確認（現在: 2026年8月頃まで有効）
- [ ] 更新手順が [AUTH.md](AUTH.md) に記載済み

### 5-4. Google Analytics / GTM

- [ ] GTM コンテナ (`GTM-PR3GFTRX`) が正常に動作
- [ ] 基本的なページビューが計測されている
- [ ] 必要に応じてコンバージョン設定（会員登録、Premium購入）

---

## 6. リリース手順（当日の流れ）

### Step 1: 最終ビルド確認
```bash
npm run build
```
TypeScript エラー、未使用変数がないことを確認。

### Step 2: Stripe本番切り替え（セクション1の手順）
1. Stripe管理画面で商品・価格・Webhook作成
2. Vercel環境変数を更新
3. Supabase Edge Functions Secretsを更新
4. Edge Functionsを再デプロイ

### Step 3: テンプレート・ライブラリ投入（セクション2の手順）
1. テンプレートをDBに登録
2. デフォルト画像をアップロード
3. DemoCanvasを更新

### Step 4: Vercelに本番デプロイ
```bash
git add -A && git commit -m "Release v1.0: production Stripe keys and content"
git push origin main
```
Vercel が自動ビルド・デプロイ。

### Step 5: 本番環境でのスモークテスト
1. トップページ表示確認
2. ゲストでバナー作成
3. ログイン（Google / Apple / Email）
4. テンプレートからバナー作成
5. Premium購入テスト（実カード）
6. 言語切り替え確認

### Step 6: 確認完了後
- テスト決済の返金処理（Stripe管理画面）
- 本番公開を宣言

---

## 7. リリース後の運用タスク

### 即時（1週間以内）

- [ ] エラー監視ツール導入検討（Sentry等）
- [ ] ユーザーからのフィードバック収集手段を用意
- [ ] 決済関連のWebhookログを毎日確認

### 短期（1ヶ月以内）

- [ ] GTM でコンバージョンイベント設定
- [ ] パフォーマンスモニタリング（Core Web Vitals）
- [ ] i18n: 翻訳品質のネイティブレビュー

### 中期（3ヶ月以内）

- [ ] CI/CD パイプライン整備（GitHub Actions）
- [ ] i18n Phase 2 言語追加（Spanish, Portuguese, French 等）
- [ ] Error Boundary 実装
- [ ] テンプレート・素材の継続的な追加

### 定期

- [ ] Apple Sign In Secret Key の更新（6ヶ月ごと、次回: 2026年8月）
- [ ] 依存パッケージのアップデート
- [ ] Supabase の使用量モニタリング
