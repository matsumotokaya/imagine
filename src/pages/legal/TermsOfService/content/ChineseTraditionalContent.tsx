import { Link } from 'react-router-dom';
import { Section } from '../index';

export function ChineseTraditionalContent() {
  return (
    <>
      <Section title="第1條 (適用)">
        <p>
          本條款規定了松本夏彌(以下簡稱「運營者」)提供的IMAGINE(以下簡稱「本服務」)的使用條件。
          使用者透過使用本服務即表示同意本條款。
        </p>
      </Section>

      <Section title="第2條 (定義)">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>「使用者」</strong>: 使用本服務的所有個人或法人
          </li>
          <li>
            <strong>「註冊使用者」</strong>: 完成帳戶註冊的使用者
          </li>
          <li>
            <strong>「進階使用者」</strong>: 訂閱付費方案的使用者
          </li>
          <li>
            <strong>「內容」</strong>: 使用者在本服務上建立·上傳的橫幅設計、圖片等
          </li>
        </ul>
      </Section>

      <Section title="第3條 (帳戶註冊)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>使用本服務需要透過Google帳戶進行身分驗證。</li>
          <li>使用者有責任保持註冊資訊的準確性和最新狀態。</li>
          <li>帳戶資訊的管理責任在於使用者,即使發生第三方未經授權使用的情況,運營者也不承擔任何責任。</li>
          <li>禁止一個使用者建立多個帳戶。</li>
        </ol>
      </Section>

      <Section title="第4條 (訂閱)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>進階方案的費用為每月$3.00(美元)。</li>
          <li>付款透過Stripe處理,每月自動續訂。</li>
          <li>使用者可以隨時從帳戶設定中取消訂閱。</li>
          <li>取消後,使用者可以繼續使用服務直到當前計費週期結束。</li>
          <li>原則上不提供退款,但在系統故障等情況下會單獨處理。</li>
        </ol>
      </Section>

      <Section title="第5條 (禁止事項)">
        <p className="mb-2">使用者不得從事以下行為:</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>違反法律或公共秩序和道德的行為</li>
          <li>與犯罪活動相關的行為</li>
          <li>侵犯他人智慧財產權、隱私權、名譽權或其他權利的行為</li>
          <li>對本服務的伺服器或網路施加過度負載的行為</li>
          <li>妨礙本服務運營的行為</li>
          <li>未經授權存取、反向工程等行為</li>
          <li>非法收集其他使用者資訊的行為</li>
          <li>註冊虛假資訊的行為</li>
          <li>向反社會勢力提供利益的行為</li>
          <li>其他運營者認為不當的行為</li>
        </ol>
      </Section>

      <Section title="第6條 (智慧財產權)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>與本服務相關的所有智慧財產權均歸運營者或合法權利人所有。</li>
          <li>使用者建立的內容的著作權歸使用者所有。</li>
          <li>使用者授權運營者為了改善和宣傳本服務而使用內容。</li>
          <li>使用者保證對上傳的內容擁有必要的權利。</li>
        </ol>
      </Section>

      <Section title="第7條 (服務變更·暫停)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>運營者可以在不事先通知的情況下變更或新增本服務的內容。</li>
          <li>在以下情況下,運營者可以暫時中止本服務:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>系統維護或更新</li>
              <li>地震、火災等不可抗力</li>
              <li>其他運營者認為必要的情況</li>
            </ul>
          </li>
          <li>對於因服務暫停而造成的損失,運營者不承擔任何責任。</li>
        </ol>
      </Section>

      <Section title="第8條 (使用限制·帳戶刪除)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>在以下情況下,運營者可以在不事先通知的情況下限制服務使用或刪除帳戶:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>違反本條款的情況</li>
              <li>註冊資訊有虛假的情況</li>
              <li>存在付款方式的不當使用的情況</li>
              <li>6個月以上未登入的情況</li>
              <li>其他運營者認為不當的情況</li>
            </ul>
          </li>
          <li>對於因使用限制或帳戶刪除而造成的損失,運營者不承擔任何責任。</li>
        </ol>
      </Section>

      <Section title="第9條 (免責聲明)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>本服務按「現狀」提供,運營者不做任何明示或默示的保證。</li>
          <li>運營者不保證本服務的準確性、完整性、有用性、安全性等。</li>
          <li>對於因使用本服務而造成的損失,運營者不承擔任何責任。</li>
          <li>對於使用者之間或使用者與第三方之間的糾紛,運營者不承擔任何責任。</li>
          <li>對於資料遺失、損壞等,運營者不承擔任何責任。建議定期備份。</li>
        </ol>
      </Section>

      <Section title="第10條 (損害賠償)">
        <p>
          如果由於運營者的責任造成損害,運營者的賠償責任以
          該使用者在過去12個月內支付的使用費用總額為上限。
        </p>
      </Section>

      <Section title="第11條 (條款變更)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>運營者可以根據需要變更本條款。</li>
          <li>變更後的條款自在本服務上公佈之時起生效。</li>
          <li>如有重要變更,將透過電子郵件等方式提前通知。</li>
          <li>變更後繼續使用本服務的,視為同意變更後的條款。</li>
        </ol>
      </Section>

      <Section title="第12條 (個人資訊)">
        <p>
          關於個人資訊的處理,請參閱
          <Link to="/legal/privacy" className="text-blue-600 hover:underline ml-1">
            隱私權政策
          </Link>
          。
        </p>
      </Section>

      <Section title="第13條 (適用法律·管轄法院)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>本條款的適用法律為日本法。</li>
          <li>關於本服務的糾紛,以橫濱地方法院為第一審專屬管轄法院。</li>
        </ol>
      </Section>

      <Section title="聯絡我們">
        <p>
          有關本條款的問題,請聯絡:
        </p>
        <p className="mt-2 text-gray-700">
          電子郵件: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
