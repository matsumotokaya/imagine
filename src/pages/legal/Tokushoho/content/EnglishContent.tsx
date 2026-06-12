import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function EnglishContent() {
  return (
    <>
      <Section title="Service Name">
        <p>IMAGINE - Design Creation Assistant Tool</p>
      </Section>

      <Section title="Contact">
        <p>Email: contact@whatif-ep.xyz</p>
        <p className="text-sm text-gray-600 mt-1">
          ※Inquiries are primarily handled via email.
        </p>
      </Section>

      <Section title="Business Operator / Representative / Address / Phone Number">
        <p>Disclosed upon request without delay.</p>
      </Section>

      <Section title="Price">
        <p>$3.00 USD per month</p>
        <p className="text-sm text-gray-600 mt-1">
          ※Prices include applicable taxes. JPY equivalent may vary based on exchange rates.
        </p>
      </Section>

      <Section title="Shipping">
        <p>No shipping charges as this is a digital service.</p>
      </Section>

      <Section title="Other Fees">
        <p>No fees other than the monthly subscription fee.</p>
      </Section>

      <Section title="Payment Method">
        <p>Credit Card</p>
        <p className="text-sm text-gray-600 mt-1">
          Accepted cards: Visa, Mastercard, American Express, JCB, etc.
        </p>
      </Section>

      <Section title="Payment Timing">
        <p>Initial payment is charged upon subscription registration, then automatically renewed monthly.</p>
      </Section>

      <Section title="Service Delivery">
        <p>Service is available immediately after payment completion.</p>
      </Section>

      <Section title="Return Policy">
        <p>As this is a digital service, refunds are generally not provided.</p>
        <p className="mt-2">
          However, refunds may be considered in the following cases:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>Extended service outage due to system failures</li>
          <li>Clear billing errors such as duplicate charges</li>
        </ul>
      </Section>

      <Section title="Cancellation Method">
        <p>You can cancel anytime from your account settings.</p>
        <p className="mt-2 text-gray-700">
          After cancellation, you will not be charged from the next renewal date. You can continue using the service until the end of the current billing period.
        </p>
      </Section>

      <Section title="System Requirements">
        <p>Recommended browsers:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>Google Chrome (latest version)</li>
          <li>Safari (latest version)</li>
          <li>Microsoft Edge (latest version)</li>
          <li>Firefox (latest version)</li>
        </ul>
      </Section>

      <Section title="Sales Volume Limit">
        <p>No specific limit.</p>
      </Section>

      <Section title="Additional Information">
        <p>
          Please also review our{' '}
          <Link to="/legal/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          {' '}and{' '}
          <Link to="/legal/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
