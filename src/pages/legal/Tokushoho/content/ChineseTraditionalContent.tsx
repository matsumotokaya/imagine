import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function ChineseTraditionalContent() {
  return (
    <>
      <Section title="服務名稱">
        <p>IMAGINE(伊馬真) - 設計製作輔助工具</p>
      </Section>

      <Section title="聯絡方式">
        <p>電子郵件: contact@whatif-ep.xyz</p>
        <p className="text-sm text-gray-600 mt-1">
          ※原則上透過電子郵件接受諮詢。
        </p>
      </Section>

      <Section title="經營者 / 運營總負責人 / 地址 / 電話號碼">
        <p>如有請求，將立即公開。</p>
      </Section>

      <Section title="銷售價格">
        <p>月費 $3.00 (美元)</p>
        <p className="text-sm text-gray-600 mt-1">
          ※價格含稅。日圓換算金額因匯率而變動。
        </p>
      </Section>

      <Section title="運費">
        <p>數位服務，無運費。</p>
      </Section>

      <Section title="其他費用">
        <p>除上述月費外，無其他費用。</p>
      </Section>

      <Section title="付款方式">
        <p>信用卡付款</p>
        <p className="text-sm text-gray-600 mt-1">
          支援的卡: Visa, Mastercard, American Express, JCB等
        </p>
      </Section>

      <Section title="付款時期">
        <p>訂閱註冊時進行首次付款，之後每月自動續訂。</p>
      </Section>

      <Section title="服務提供時期">
        <p>付款完成後可立即使用。</p>
      </Section>

      <Section title="退貨條款">
        <p>本服務為數位內容，原則上不予退款。</p>
        <p className="mt-2">
          但是，以下情況將考慮退款:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>因系統故障長期無法使用服務的情況</li>
          <li>存在明顯的重複收費等帳單錯誤的情況</li>
        </ul>
      </Section>

      <Section title="取消方法">
        <p>可隨時從帳戶設定頁面取消。</p>
        <p className="mt-2 text-gray-700">
          取消手續完成後，下次續訂日起不再收費。在當前計費期間內可繼續使用服務。
        </p>
      </Section>

      <Section title="運行環境">
        <p>推薦使用以下瀏覽器:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>Google Chrome (最新版本)</li>
          <li>Safari (最新版本)</li>
          <li>Microsoft Edge (最新版本)</li>
          <li>Firefox (最新版本)</li>
        </ul>
      </Section>

      <Section title="銷售數量限制">
        <p>無特殊限制。</p>
      </Section>

      <Section title="其他">
        <p>
          請同時查看我們的
          <Link to="/legal/privacy" className="text-blue-600 hover:underline mx-1">
            隱私權政策
          </Link>
          和
          <Link to="/legal/terms" className="text-blue-600 hover:underline ml-1">
            使用條款
          </Link>
          。
        </p>
      </Section>
    </>
  );
}
