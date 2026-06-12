import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function JapaneseContent() {
  return (
    <>
      <Section title="サービス名">
        <p>IMAGINE(イマジン) - デザイン制作アシスタントツール</p>
      </Section>

      <Section title="連絡先">
        <p>メールアドレス: contact@whatif-ep.xyz</p>
        <p className="text-sm text-gray-600 mt-1">
          ※お問い合わせは、原則としてメールにて受け付けております。
        </p>
      </Section>

      <Section title="事業者名 / 運営統括責任者 / 所在地 / 電話番号">
        <p>請求があった場合、遅滞なく開示いたします。</p>
      </Section>

      <Section title="販売価格">
        <p>月額 $3.00（米ドル）</p>
        <p className="text-sm text-gray-600 mt-1">
          ※価格は税込みです。為替レートにより日本円換算額は変動します。
        </p>
      </Section>

      <Section title="送料">
        <p>デジタルサービスのため送料はかかりません。</p>
      </Section>

      <Section title="その他の費用">
        <p>上記の月額料金以外に費用はかかりません。</p>
      </Section>

      <Section title="支払い方法">
        <p>クレジットカード決済</p>
        <p className="text-sm text-gray-600 mt-1">
          対応カード: Visa, Mastercard, American Express, JCB等
        </p>
      </Section>

      <Section title="支払い時期">
        <p>サブスクリプション登録時に初回決済が行われ、以降は毎月自動更新されます。</p>
      </Section>

      <Section title="サービス提供時期">
        <p>決済完了後、即時ご利用いただけます。</p>
      </Section>

      <Section title="返品特約">
        <p>本サービスはデジタルコンテンツのため、原則として返金には応じかねます。</p>
        <p className="mt-2">
          ただし、以下の場合は返金対応を検討いたします：
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>システム障害により長期間サービスが利用できなかった場合</li>
          <li>二重課金などの明らかな請求エラーがあった場合</li>
        </ul>
      </Section>

      <Section title="解約方法">
        <p>アカウント設定画面からいつでも解約可能です。</p>
        <p className="mt-2 text-gray-700">
          解約手続き完了後、次回の更新日以降は課金されません。現在の請求期間内は引き続きサービスをご利用いただけます。
        </p>
      </Section>

      <Section title="動作環境">
        <p>以下のブラウザでの動作を推奨します：</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>Google Chrome（最新版）</li>
          <li>Safari（最新版）</li>
          <li>Microsoft Edge（最新版）</li>
          <li>Firefox（最新版）</li>
        </ul>
      </Section>

      <Section title="販売数量の制限">
        <p>特に制限はございません。</p>
      </Section>

      <Section title="その他">
        <p>
          <Link to="/legal/privacy" className="text-blue-600 hover:underline">
            プライバシーポリシー
          </Link>
          および
          <Link to="/legal/terms" className="text-blue-600 hover:underline ml-1">
            利用規約
          </Link>
          も併せてご確認ください。
        </p>
      </Section>
    </>
  );
}
