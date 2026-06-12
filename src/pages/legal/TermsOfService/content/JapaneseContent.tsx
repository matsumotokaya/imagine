import { Link } from 'react-router-dom';
import { Section } from '../index';

export function JapaneseContent() {
  return (
    <>
      <Section title="第1条(適用)">
        <p>
          本規約は、松本夏弥(以下「運営者」)が提供するIMAGINE(イマジン)(以下「本サービス」)の利用条件を定めるものです。
          ユーザーは、本サービスを利用することにより、本規約に同意したものとみなされます。
        </p>
      </Section>

      <Section title="第2条(定義)">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>「ユーザー」</strong>: 本サービスを利用するすべての個人または法人
          </li>
          <li>
            <strong>「登録ユーザー」</strong>: アカウント登録を完了したユーザー
          </li>
          <li>
            <strong>「プレミアムユーザー」</strong>: 有料プランに登録したユーザー
          </li>
          <li>
            <strong>「コンテンツ」</strong>: ユーザーが本サービス上で作成・アップロードしたバナーデザイン、画像等
          </li>
        </ul>
      </Section>

      <Section title="第3条(アカウント登録)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>本サービスの利用には、Google アカウントによる認証が必要です。</li>
          <li>ユーザーは、登録情報を正確かつ最新の状態に保つ責任を負います。</li>
          <li>アカウント情報の管理責任はユーザーにあり、第三者による不正利用があった場合でも、運営者は一切の責任を負いません。</li>
          <li>1人のユーザーが複数のアカウントを作成することを禁止します。</li>
        </ol>
      </Section>

      <Section title="第4条(サブスクリプション)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>プレミアムプランの料金は月額$3.00(米ドル)です。</li>
          <li>決済はStripeを通じて処理され、毎月自動更新されます。</li>
          <li>ユーザーはいつでもアカウント設定から解約できます。</li>
          <li>解約後も、現在の請求期間が終了するまでサービスを利用できます。</li>
          <li>原則として返金には応じませんが、システム障害等の場合は個別に対応します。</li>
        </ol>
      </Section>

      <Section title="第5条(禁止事項)">
        <p className="mb-2">ユーザーは、以下の行為を行ってはなりません:</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>法令または公序良俗に違反する行為</li>
          <li>犯罪行為に関連する行為</li>
          <li>他者の知的財産権、プライバシー権、名誉権その他の権利を侵害する行為</li>
          <li>本サービスのサーバーやネットワークに過度な負荷をかける行為</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>不正アクセス、リバースエンジニアリング等の行為</li>
          <li>他のユーザーの情報を不正に収集する行為</li>
          <li>虚偽の情報を登録する行為</li>
          <li>反社会的勢力への利益供与</li>
          <li>その他、運営者が不適切と判断する行為</li>
        </ol>
      </Section>

      <Section title="第6条(知的財産権)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>本サービスに関する知的財産権は、すべて運営者または正当な権利者に帰属します。</li>
          <li>ユーザーが作成したコンテンツの著作権は、ユーザーに帰属します。</li>
          <li>ユーザーは、本サービスの改善・宣伝目的で、運営者がコンテンツを使用することを許諾します。</li>
          <li>ユーザーは、アップロードするコンテンツについて、必要な権利を有していることを保証します。</li>
        </ol>
      </Section>

      <Section title="第7条(サービスの変更・停止)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>運営者は、事前の通知なく本サービスの内容を変更または追加できます。</li>
          <li>以下の場合、運営者は本サービスを一時的に停止できます:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>システムメンテナンスまたは更新</li>
              <li>地震、火災等の不可抗力</li>
              <li>その他、運営者が必要と判断した場合</li>
            </ul>
          </li>
          <li>サービス停止により生じた損害について、運営者は一切の責任を負いません。</li>
        </ol>
      </Section>

      <Section title="第8条(利用制限・アカウント削除)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>運営者は、以下の場合、事前通知なくサービス利用を制限またはアカウントを削除できます:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>本規約に違反した場合</li>
              <li>登録情報に虚偽があった場合</li>
              <li>決済手段の不正利用があった場合</li>
              <li>6ヶ月以上ログインがない場合</li>
              <li>その他、運営者が不適切と判断した場合</li>
            </ul>
          </li>
          <li>利用制限またはアカウント削除により生じた損害について、運営者は一切の責任を負いません。</li>
        </ol>
      </Section>

      <Section title="第9条(免責事項)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>本サービスは「現状有姿」で提供され、運営者は明示・黙示を問わず一切の保証をしません。</li>
          <li>運営者は、本サービスの正確性、完全性、有用性、安全性等を保証しません。</li>
          <li>本サービスの利用により生じた損害について、運営者は一切の責任を負いません。</li>
          <li>ユーザー間またはユーザーと第三者との間のトラブルについて、運営者は一切の責任を負いません。</li>
          <li>データの消失、破損等について、運営者は一切の責任を負いません。定期的なバックアップを推奨します。</li>
        </ol>
      </Section>

      <Section title="第10条(損害賠償)">
        <p>
          運営者の責に帰すべき事由により損害が発生した場合、運営者の賠償責任は、
          当該ユーザーが過去12ヶ月間に支払った利用料金の総額を上限とします。
        </p>
      </Section>

      <Section title="第11条(規約の変更)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>運営者は、必要に応じて本規約を変更できます。</li>
          <li>変更後の規約は、本サービス上に掲載した時点で効力を生じます。</li>
          <li>重要な変更がある場合は、事前にメール等で通知します。</li>
          <li>変更後も本サービスを利用した場合、変更後の規約に同意したものとみなされます。</li>
        </ol>
      </Section>

      <Section title="第12条(個人情報)">
        <p>
          個人情報の取扱いについては、
          <Link to="/legal/privacy" className="text-blue-600 hover:underline ml-1">
            プライバシーポリシー
          </Link>
          をご確認ください。
        </p>
      </Section>

      <Section title="第13条(準拠法・管轄裁判所)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>本規約の準拠法は日本法とします。</li>
          <li>本サービスに関する紛争については、横浜地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
        </ol>
      </Section>

      <Section title="お問い合わせ">
        <p>
          本規約に関するご質問は、以下までお問い合わせください:
        </p>
        <p className="mt-2 text-gray-700">
          メールアドレス: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
