# Stripe実装ガイド

## 環境変数一覧

### Frontend (Vercel)
| 変数名 | 用途 | 例 |
|--------|------|-----|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe公開キー | `pk_test_xxx` / `pk_live_xxx` |
| `VITE_STRIPE_PRICE_ID` | サブスクリプション価格ID | `price_xxx` |

### Backend (Supabase Edge Functions)
| 変数名 | 用途 | 例 |
|--------|------|-----|
| `STRIPE_SECRET_KEY` | Stripeシークレットキー | `sk_test_xxx` / `sk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Webhook署名検証 | `whsec_xxx` |

---

## Stripe管理画面設定

### 1. 商品・価格の作成
- Products > Add product
- 価格設定: Recurring（月額 $3.00）
- **Price ID** をコピー（`price_xxx`）

### 2. Webhookエンドポイント設定
- Developers > Webhooks > Add endpoint
- **URL**: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- **Events**:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- **Signing Secret** をコピー（`whsec_xxx`）

### 3. APIキー取得
- Developers > API keys
- **Publishable key**: `pk_xxx`
- **Secret key**: `sk_xxx`

---

## Supabase Edge Functions

### Secrets設定場所
Settings > Edge Functions > Edge Function Secrets

### 必要なSecrets
```
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### デプロイ
```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
```

---

## Vercel設定

### 環境変数設定場所
Project Settings > Environment Variables

### SPA対応 (vercel.json)
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```
- `/success` 等のクライアントサイドルーティングで404を防ぐ
- Stripe決済後のリダイレクト先が正しく表示される

---

## コード実装

### Price IDの環境変数化
```typescript
// Before (ハードコード)
const STRIPE_PRICE_ID = 'price_xxx';

// After (環境変数)
const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID;
```

### Checkout Session作成 (Edge Function)
- `success_url`: 決済成功後のリダイレクト先
- `cancel_url`: キャンセル時のリダイレクト先
- `client_reference_id`: ユーザーID（Webhook処理で使用）
- `metadata`: 追加情報（Webhook処理で使用）

### Webhook処理 (Edge Function)
- 署名検証: `stripe.webhooks.constructEvent(body, sig, secret)`
- `checkout.session.completed`: 初回決済成功 → profiles更新 (`subscription_status = 'active'`)
- `customer.subscription.updated`: サブスク更新、`cancel_at_period_end` 検知 → `subscription_status = 'canceling'`
- `customer.subscription.deleted`: サブスク解約 → tier を free、status を canceled に戻す

### Billing Portal (サブスク管理)
- `create-portal-session`: Stripe Customer Portal セッション作成
- ユーザーはPortalでキャンセル・支払い方法変更が可能

---

## Price ID 一覧

| 環境 | Price ID |
|------|----------|
| Test (Sandbox) | `price_1SgTcWLhSi3I8k5ljpx47yjl` |
| Live (Production) | `price_1ThWnuQ2eK2Q8eWbgAEh4fwE` |

## Webhook エンドポイント（Live）

| 項目 | 値 |
|------|-----|
| 支払先 ID | `we_1T0kvDQ2eK2Q8eWbwh7tdrli` |
| 名前 | `engaging-victory` |
| URL | `https://rgqduwojvylkulhyodqg.supabase.co/functions/v1/stripe-webhook` |
| API バージョン | `2025-12-15.clover` |

**リッスン対象イベント（3件）:**
- `checkout.session.completed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

---

## テスト/本番切り替えチェックリスト

### テスト → 本番
- [ ] Stripe管理画面でLiveモードに切り替え
- [ ] 本番用商品・価格を作成
- [ ] 本番用Webhookエンドポイント追加
- [ ] Vercel環境変数を本番キーに更新
  - `VITE_STRIPE_PUBLISHABLE_KEY`
  - `VITE_STRIPE_PRICE_ID`
- [ ] Supabase Edge Functions Secretsを本番キーに更新
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- [ ] テスト決済で動作確認

### テスト用カード番号
| カード | 番号 |
|--------|------|
| 成功 | `4242 4242 4242 4242` |
| 認証必要 | `4000 0025 0000 3155` |
| 失敗 | `4000 0000 0000 9995` |

---

## トラブルシューティング

### 404 NOT_FOUND (決済後リダイレクト)
- 原因: `vercel.json` がない
- 対策: SPAリライト設定を追加

### Webhook署名検証エラー
- 原因: `STRIPE_WEBHOOK_SECRET` が間違っている
- 対策: Stripeダッシュボードから正しいSecretをコピー

### profiles更新されない
- 原因: Webhook未設定 / RLSポリシー
- 対策: Webhookログ確認、Edge Functionはservice_role使用

---

## profiles テーブル

### 必須カラム
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT
CHECK (subscription_status IN ('active', 'canceling', 'canceled'));
```

### ステータス
- `active`: アクティブ、自動更新予定
- `canceling`: キャンセル済み、期間終了まで利用可能
- `canceled`: 完全終了

---

## ファイル構成

```
src/
├── components/
│   └── UpgradeModal.tsx      # 決済ボタンUI
├── pages/
│   ├── PaymentSuccess.tsx    # 決済成功ページ
│   └── MyPage.tsx            # マイページ（サブスク状態表示）
└── utils/
    └── supabase.ts           # Supabaseクライアント

supabase/functions/
├── create-checkout-session/
│   └── index.ts              # Checkout Session作成
├── create-portal-session/
│   └── index.ts              # Billing Portal セッション作成
└── stripe-webhook/
    └── index.ts              # Webhook処理
```
