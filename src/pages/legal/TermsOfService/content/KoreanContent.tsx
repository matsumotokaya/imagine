import { Link } from 'react-router-dom';
import { Section } from '../index';

export function KoreanContent() {
  return (
    <>
      <Section title="제1조 (적용)">
        <p>
          본 약관은 마츠모토 카야(이하 "운영자")가 제공하는 IMAGINE(이하 "본 서비스")의 이용 조건을 정합니다.
          사용자는 본 서비스를 이용함으로써 본 약관에 동의한 것으로 간주됩니다.
        </p>
      </Section>

      <Section title="제2조 (정의)">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>"사용자"</strong>: 본 서비스를 이용하는 모든 개인 또는 법인
          </li>
          <li>
            <strong>"등록 사용자"</strong>: 계정 등록을 완료한 사용자
          </li>
          <li>
            <strong>"프리미엄 사용자"</strong>: 유료 플랜에 가입한 사용자
          </li>
          <li>
            <strong>"콘텐츠"</strong>: 사용자가 본 서비스에서 생성·업로드한 배너 디자인, 이미지 등
          </li>
        </ul>
      </Section>

      <Section title="제3조 (계정 등록)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>본 서비스 이용에는 Google 계정을 통한 인증이 필요합니다.</li>
          <li>사용자는 등록 정보를 정확하고 최신 상태로 유지할 책임이 있습니다.</li>
          <li>계정 정보 관리 책임은 사용자에게 있으며, 제3자의 부정 사용이 있더라도 운영자는 일체의 책임을 지지 않습니다.</li>
          <li>1명의 사용자가 여러 계정을 생성하는 것을 금지합니다.</li>
        </ol>
      </Section>

      <Section title="제4조 (구독)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>프리미엄 플랜의 요금은 월 $3.00(미국 달러)입니다.</li>
          <li>결제는 Stripe를 통해 처리되며, 매월 자동으로 갱신됩니다.</li>
          <li>사용자는 언제든지 계정 설정에서 해지할 수 있습니다.</li>
          <li>해지 후에도 현재 청구 기간이 종료될 때까지 서비스를 이용할 수 있습니다.</li>
          <li>원칙적으로 환불은 제공하지 않으나, 시스템 장애 등의 경우에는 개별적으로 대응합니다.</li>
        </ol>
      </Section>

      <Section title="제5조 (금지 사항)">
        <p className="mb-2">사용자는 다음 행위를 하여서는 안 됩니다:</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>법령 또는 공공질서와 미풍양속에 위반하는 행위</li>
          <li>범죄 행위와 관련된 행위</li>
          <li>타인의 지적재산권, 프라이버시권, 명예권 기타 권리를 침해하는 행위</li>
          <li>본 서비스의 서버나 네트워크에 과도한 부하를 주는 행위</li>
          <li>본 서비스의 운영을 방해하는 행위</li>
          <li>부정 접근, 리버스 엔지니어링 등의 행위</li>
          <li>다른 사용자의 정보를 부정하게 수집하는 행위</li>
          <li>허위 정보를 등록하는 행위</li>
          <li>반사회적 세력에 이익을 제공하는 행위</li>
          <li>기타 운영자가 부적절하다고 판단하는 행위</li>
        </ol>
      </Section>

      <Section title="제6조 (지적재산권)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>본 서비스에 관한 지적재산권은 모두 운영자 또는 정당한 권리자에게 귀속됩니다.</li>
          <li>사용자가 생성한 콘텐츠의 저작권은 사용자에게 귀속됩니다.</li>
          <li>사용자는 본 서비스의 개선·홍보 목적으로 운영자가 콘텐츠를 사용하는 것을 허락합니다.</li>
          <li>사용자는 업로드하는 콘텐츠에 대해 필요한 권리를 보유하고 있음을 보증합니다.</li>
        </ol>
      </Section>

      <Section title="제7조 (서비스 변경·중지)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>운영자는 사전 통지 없이 본 서비스의 내용을 변경하거나 추가할 수 있습니다.</li>
          <li>다음의 경우, 운영자는 본 서비스를 일시적으로 중지할 수 있습니다:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>시스템 유지보수 또는 업데이트</li>
              <li>지진, 화재 등의 불가항력</li>
              <li>기타 운영자가 필요하다고 판단한 경우</li>
            </ul>
          </li>
          <li>서비스 중지로 인해 발생한 손해에 대해 운영자는 일체의 책임을 지지 않습니다.</li>
        </ol>
      </Section>

      <Section title="제8조 (이용 제한·계정 삭제)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>운영자는 다음의 경우, 사전 통지 없이 서비스 이용을 제한하거나 계정을 삭제할 수 있습니다:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>본 약관을 위반한 경우</li>
              <li>등록 정보에 허위가 있는 경우</li>
              <li>결제 수단의 부정 사용이 있는 경우</li>
              <li>6개월 이상 로그인이 없는 경우</li>
              <li>기타 운영자가 부적절하다고 판단한 경우</li>
            </ul>
          </li>
          <li>이용 제한 또는 계정 삭제로 인해 발생한 손해에 대해 운영자는 일체의 책임을 지지 않습니다.</li>
        </ol>
      </Section>

      <Section title="제9조 (면책 사항)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>본 서비스는 "있는 그대로" 제공되며, 운영자는 명시·묵시를 불문하고 일체의 보증을 하지 않습니다.</li>
          <li>운영자는 본 서비스의 정확성, 완전성, 유용성, 안전성 등을 보증하지 않습니다.</li>
          <li>본 서비스 이용으로 인해 발생한 손해에 대해 운영자는 일체의 책임을 지지 않습니다.</li>
          <li>사용자 간 또는 사용자와 제3자 간의 트러블에 대해 운영자는 일체의 책임을 지지 않습니다.</li>
          <li>데이터 손실, 파손 등에 대해 운영자는 일체의 책임을 지지 않습니다. 정기적인 백업을 권장합니다.</li>
        </ol>
      </Section>

      <Section title="제10조 (손해배상)">
        <p>
          운영자의 귀책 사유로 손해가 발생한 경우, 운영자의 배상 책임은
          해당 사용자가 과거 12개월간 지불한 이용 요금 총액을 상한으로 합니다.
        </p>
      </Section>

      <Section title="제11조 (약관 변경)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>운영자는 필요에 따라 본 약관을 변경할 수 있습니다.</li>
          <li>변경된 약관은 본 서비스에 게재한 시점부터 효력이 발생합니다.</li>
          <li>중요한 변경이 있는 경우 사전에 이메일 등으로 통지합니다.</li>
          <li>변경 후에도 본 서비스를 이용한 경우, 변경된 약관에 동의한 것으로 간주됩니다.</li>
        </ol>
      </Section>

      <Section title="제12조 (개인정보)">
        <p>
          개인정보 취급에 대해서는
          <Link to="/legal/privacy" className="text-blue-600 hover:underline ml-1">
            개인정보 처리방침
          </Link>
          을 확인해 주세요.
        </p>
      </Section>

      <Section title="제13조 (준거법·관할법원)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>본 약관의 준거법은 일본법으로 합니다.</li>
          <li>본 서비스에 관한 분쟁에 대해서는 요코하마 지방법원을 제1심의 전속적 합의 관할법원으로 합니다.</li>
        </ol>
      </Section>

      <Section title="문의하기">
        <p>
          본 약관에 관한 질문은 다음으로 문의해 주세요:
        </p>
        <p className="mt-2 text-gray-700">
          이메일: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
