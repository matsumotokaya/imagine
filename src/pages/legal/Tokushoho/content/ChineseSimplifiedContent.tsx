import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function ChineseSimplifiedContent() {
  return (
    <>
      <Section title="服务名称">
        <p>IMAGINE(伊马真) - 设计制作辅助工具</p>
      </Section>

      <Section title="联系方式">
        <p>电子邮件: contact@whatif-ep.xyz</p>
        <p className="text-sm text-gray-600 mt-1">
          ※原则上通过电子邮件接受咨询。
        </p>
      </Section>

      <Section title="经营者 / 运营总负责人 / 地址 / 电话号码">
        <p>如有请求，将立即公开。</p>
      </Section>

      <Section title="销售价格">
        <p>月费 $3.00 (美元)</p>
        <p className="text-sm text-gray-600 mt-1">
          ※价格含税。日元换算金额因汇率而变动。
        </p>
      </Section>

      <Section title="运费">
        <p>数字服务，无运费。</p>
      </Section>

      <Section title="其他费用">
        <p>除上述月费外，无其他费用。</p>
      </Section>

      <Section title="支付方式">
        <p>信用卡支付</p>
        <p className="text-sm text-gray-600 mt-1">
          支持的卡: Visa, Mastercard, American Express, JCB等
        </p>
      </Section>

      <Section title="支付时期">
        <p>订阅注册时进行首次支付，之后每月自动续订。</p>
      </Section>

      <Section title="服务提供时期">
        <p>支付完成后可立即使用。</p>
      </Section>

      <Section title="退货条款">
        <p>本服务为数字内容，原则上不予退款。</p>
        <p className="mt-2">
          但是，以下情况将考虑退款:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>因系统故障长期无法使用服务的情况</li>
          <li>存在明显的重复收费等账单错误的情况</li>
        </ul>
      </Section>

      <Section title="取消方法">
        <p>可随时从账户设置页面取消。</p>
        <p className="mt-2 text-gray-700">
          取消手续完成后，下次续订日起不再收费。在当前计费期间内可继续使用服务。
        </p>
      </Section>

      <Section title="运行环境">
        <p>推荐使用以下浏览器:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>Google Chrome (最新版本)</li>
          <li>Safari (最新版本)</li>
          <li>Microsoft Edge (最新版本)</li>
          <li>Firefox (最新版本)</li>
        </ul>
      </Section>

      <Section title="销售数量限制">
        <p>无特殊限制。</p>
      </Section>

      <Section title="其他">
        <p>
          请同时查看我们的
          <Link to="/legal/privacy" className="text-blue-600 hover:underline mx-1">
            隐私政策
          </Link>
          和
          <Link to="/legal/terms" className="text-blue-600 hover:underline ml-1">
            使用条款
          </Link>
          。
        </p>
      </Section>
    </>
  );
}
