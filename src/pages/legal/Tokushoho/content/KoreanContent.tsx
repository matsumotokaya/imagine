import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function KoreanContent() {
  return (
    <>
      <Section title="서비스명">
        <p>IMAGINE(이매진) - 디자인 제작 어시스턴트 도구</p>
      </Section>

      <Section title="연락처">
        <p>이메일: contact@whatif-ep.xyz</p>
        <p className="text-sm text-gray-600 mt-1">
          ※문의는 원칙적으로 이메일로 받고 있습니다.
        </p>
      </Section>

      <Section title="사업자명 / 운영 총괄 책임자 / 소재지 / 전화번호">
        <p>요청 시 지체 없이 공개합니다.</p>
      </Section>

      <Section title="판매 가격">
        <p>월 $3.00 (미국 달러)</p>
        <p className="text-sm text-gray-600 mt-1">
          ※가격은 세금 포함입니다. 환율에 따라 일본 엔 환산액은 변동될 수 있습니다.
        </p>
      </Section>

      <Section title="배송비">
        <p>디지털 서비스이므로 배송비는 없습니다.</p>
      </Section>

      <Section title="기타 비용">
        <p>위의 월정액 외에 비용은 발생하지 않습니다.</p>
      </Section>

      <Section title="결제 방법">
        <p>신용카드 결제</p>
        <p className="text-sm text-gray-600 mt-1">
          지원 카드: Visa, Mastercard, American Express, JCB 등
        </p>
      </Section>

      <Section title="결제 시기">
        <p>구독 등록 시 첫 결제가 이루어지며, 이후 매월 자동 갱신됩니다.</p>
      </Section>

      <Section title="서비스 제공 시기">
        <p>결제 완료 후 즉시 이용하실 수 있습니다.</p>
      </Section>

      <Section title="반품 특약">
        <p>본 서비스는 디지털 콘텐츠이므로 원칙적으로 환불에 응하지 않습니다.</p>
        <p className="mt-2">
          단, 다음의 경우 환불 대응을 검토합니다:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>시스템 장애로 인해 장기간 서비스를 이용할 수 없었던 경우</li>
          <li>중복 청구 등 명백한 청구 오류가 있었던 경우</li>
        </ul>
      </Section>

      <Section title="해지 방법">
        <p>계정 설정 화면에서 언제든지 해지할 수 있습니다.</p>
        <p className="mt-2 text-gray-700">
          해지 절차 완료 후 다음 갱신일부터 과금되지 않습니다. 현재 청구 기간 내에는 계속 서비스를 이용하실 수 있습니다.
        </p>
      </Section>

      <Section title="동작 환경">
        <p>다음 브라우저에서의 동작을 권장합니다:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>Google Chrome (최신 버전)</li>
          <li>Safari (최신 버전)</li>
          <li>Microsoft Edge (최신 버전)</li>
          <li>Firefox (최신 버전)</li>
        </ul>
      </Section>

      <Section title="판매 수량 제한">
        <p>특별한 제한은 없습니다.</p>
      </Section>

      <Section title="기타">
        <p>
          <Link to="/legal/privacy" className="text-blue-600 hover:underline">
            개인정보처리방침
          </Link>
          및
          <Link to="/legal/terms" className="text-blue-600 hover:underline ml-1">
            이용약관
          </Link>
          도 함께 확인해 주세요.
        </p>
      </Section>
    </>
  );
}
