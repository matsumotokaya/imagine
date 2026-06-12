import { Link } from 'react-router-dom';
import { Section } from '../index';

export function ChineseSimplifiedContent() {
  return (
    <>
      <Section title="第1条 (适用)">
        <p>
          本条款规定了松本夏弥(以下简称"运营者")提供的IMAGINE(以下简称"本服务")的使用条件。
          用户通过使用本服务即表示同意本条款。
        </p>
      </Section>

      <Section title="第2条 (定义)">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>"用户"</strong>: 使用本服务的所有个人或法人
          </li>
          <li>
            <strong>"注册用户"</strong>: 完成账户注册的用户
          </li>
          <li>
            <strong>"高级用户"</strong>: 订阅付费计划的用户
          </li>
          <li>
            <strong>"内容"</strong>: 用户在本服务上创建·上传的横幅设计、图片等
          </li>
        </ul>
      </Section>

      <Section title="第3条 (账户注册)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>使用本服务需要通过Google账户进行身份验证。</li>
          <li>用户有责任保持注册信息的准确性和最新状态。</li>
          <li>账户信息的管理责任在于用户,即使发生第三方未经授权使用的情况,运营者也不承担任何责任。</li>
          <li>禁止一个用户创建多个账户。</li>
        </ol>
      </Section>

      <Section title="第4条 (订阅)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>高级计划的费用为每月$3.00(美元)。</li>
          <li>付款通过Stripe处理,每月自动续订。</li>
          <li>用户可以随时从账户设置中取消订阅。</li>
          <li>取消后,用户可以继续使用服务直到当前计费周期结束。</li>
          <li>原则上不提供退款,但在系统故障等情况下会单独处理。</li>
        </ol>
      </Section>

      <Section title="第5条 (禁止事项)">
        <p className="mb-2">用户不得从事以下行为:</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>违反法律或公共秩序和道德的行为</li>
          <li>与犯罪活动相关的行为</li>
          <li>侵犯他人知识产权、隐私权、名誉权或其他权利的行为</li>
          <li>给本服务的服务器或网络施加过度负载的行为</li>
          <li>妨碍本服务运营的行为</li>
          <li>未经授权访问、反向工程等行为</li>
          <li>非法收集其他用户信息的行为</li>
          <li>注册虚假信息的行为</li>
          <li>向反社会势力提供利益的行为</li>
          <li>其他运营者认为不当的行为</li>
        </ol>
      </Section>

      <Section title="第6条 (知识产权)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>与本服务相关的所有知识产权均归运营者或合法权利人所有。</li>
          <li>用户创建的内容的著作权归用户所有。</li>
          <li>用户授权运营者为了改善和宣传本服务而使用内容。</li>
          <li>用户保证对上传的内容拥有必要的权利。</li>
        </ol>
      </Section>

      <Section title="第7条 (服务变更·暂停)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>运营者可以在不事先通知的情况下变更或添加本服务的内容。</li>
          <li>在以下情况下,运营者可以暂时中止本服务:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>系统维护或更新</li>
              <li>地震、火灾等不可抗力</li>
              <li>其他运营者认为必要的情况</li>
            </ul>
          </li>
          <li>对于因服务暂停而造成的损失,运营者不承担任何责任。</li>
        </ol>
      </Section>

      <Section title="第8条 (使用限制·账户删除)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>在以下情况下,运营者可以在不事先通知的情况下限制服务使用或删除账户:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>违反本条款的情况</li>
              <li>注册信息有虚假的情况</li>
              <li>存在付款方式的不当使用的情况</li>
              <li>6个月以上未登录的情况</li>
              <li>其他运营者认为不当的情况</li>
            </ul>
          </li>
          <li>对于因使用限制或账户删除而造成的损失,运营者不承担任何责任。</li>
        </ol>
      </Section>

      <Section title="第9条 (免责声明)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>本服务按"现状"提供,运营者不做任何明示或默示的保证。</li>
          <li>运营者不保证本服务的准确性、完整性、有用性、安全性等。</li>
          <li>对于因使用本服务而造成的损失,运营者不承担任何责任。</li>
          <li>对于用户之间或用户与第三方之间的纠纷,运营者不承担任何责任。</li>
          <li>对于数据丢失、损坏等,运营者不承担任何责任。建议定期备份。</li>
        </ol>
      </Section>

      <Section title="第10条 (损害赔偿)">
        <p>
          如果由于运营者的责任造成损害,运营者的赔偿责任以
          该用户在过去12个月内支付的使用费用总额为上限。
        </p>
      </Section>

      <Section title="第11条 (条款变更)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>运营者可以根据需要变更本条款。</li>
          <li>变更后的条款自在本服务上公布之时起生效。</li>
          <li>如有重要变更,将通过电子邮件等方式提前通知。</li>
          <li>变更后继续使用本服务的,视为同意变更后的条款。</li>
        </ol>
      </Section>

      <Section title="第12条 (个人信息)">
        <p>
          关于个人信息的处理,请参阅
          <Link to="/legal/privacy" className="text-blue-600 hover:underline ml-1">
            隐私政策
          </Link>
          。
        </p>
      </Section>

      <Section title="第13条 (适用法律·管辖法院)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>本条款的适用法律为日本法。</li>
          <li>关于本服务的纠纷,以横滨地方法院为第一审专属管辖法院。</li>
        </ol>
      </Section>

      <Section title="联系我们">
        <p>
          有关本条款的问题,请联系:
        </p>
        <p className="mt-2 text-gray-700">
          电子邮件: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
