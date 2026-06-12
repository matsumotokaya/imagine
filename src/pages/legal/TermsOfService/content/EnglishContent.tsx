import { Link } from 'react-router-dom';
import { Section } from '../index';

export function EnglishContent() {
  return (
    <>
      <Section title="Article 1 (Application)">
        <p>
          These Terms of Service ("Terms") govern the use of IMAGINE ("Service") provided by Kaya Matsumoto ("Operator").
          By using the Service, users agree to be bound by these Terms.
        </p>
      </Section>

      <Section title="Article 2 (Definitions)">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>"User"</strong>: Any individual or entity using the Service
          </li>
          <li>
            <strong>"Registered User"</strong>: User who has completed account registration
          </li>
          <li>
            <strong>"Premium User"</strong>: User subscribed to the paid plan
          </li>
          <li>
            <strong>"Content"</strong>: Banner designs, images, etc. created or uploaded by users
          </li>
        </ul>
      </Section>

      <Section title="Article 3 (Account Registration)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Using the Service requires authentication via Google Account.</li>
          <li>Users are responsible for keeping their registration information accurate and up-to-date.</li>
          <li>Users are responsible for managing their account information. The Operator is not liable for unauthorized use by third parties.</li>
          <li>Creating multiple accounts per user is prohibited.</li>
        </ol>
      </Section>

      <Section title="Article 4 (Subscription)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>The Premium plan costs $3.00 USD per month.</li>
          <li>Payments are processed through Stripe and automatically renewed monthly.</li>
          <li>Users can cancel anytime from account settings.</li>
          <li>After cancellation, service access continues until the end of the current billing period.</li>
          <li>Refunds are generally not provided, except in cases of system failures or other exceptional circumstances.</li>
        </ol>
      </Section>

      <Section title="Article 5 (Prohibited Activities)">
        <p className="mb-2">Users must not engage in the following activities:</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Violating laws or public order and morals</li>
          <li>Criminal activities</li>
          <li>Infringing intellectual property rights, privacy rights, reputation, or other rights of others</li>
          <li>Imposing excessive load on Service servers or networks</li>
          <li>Interfering with Service operations</li>
          <li>Unauthorized access, reverse engineering, etc.</li>
          <li>Illegally collecting other users' information</li>
          <li>Registering false information</li>
          <li>Providing benefits to antisocial forces</li>
          <li>Other activities deemed inappropriate by the Operator</li>
        </ol>
      </Section>

      <Section title="Article 6 (Intellectual Property)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>All intellectual property rights related to the Service belong to the Operator or legitimate rights holders.</li>
          <li>Copyright of user-created Content belongs to the user.</li>
          <li>Users grant the Operator permission to use Content for Service improvement and promotional purposes.</li>
          <li>Users warrant that they have necessary rights for all uploaded Content.</li>
        </ol>
      </Section>

      <Section title="Article 7 (Service Changes and Suspension)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>The Operator may change or add to the Service without prior notice.</li>
          <li>The Operator may temporarily suspend the Service in the following cases:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>System maintenance or updates</li>
              <li>Force majeure events (earthquakes, fires, etc.)</li>
              <li>Other cases deemed necessary by the Operator</li>
            </ul>
          </li>
          <li>The Operator is not liable for damages caused by service suspension.</li>
        </ol>
      </Section>

      <Section title="Article 8 (Usage Restrictions and Account Deletion)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>The Operator may restrict service usage or delete accounts without prior notice in the following cases:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>Violation of these Terms</li>
              <li>False registration information</li>
              <li>Fraudulent use of payment methods</li>
              <li>No login for 6 months or more</li>
              <li>Other cases deemed inappropriate by the Operator</li>
            </ul>
          </li>
          <li>The Operator is not liable for damages caused by usage restrictions or account deletion.</li>
        </ol>
      </Section>

      <Section title="Article 9 (Disclaimer)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>The Service is provided "as is" without any warranties, express or implied.</li>
          <li>The Operator does not guarantee accuracy, completeness, usefulness, or safety of the Service.</li>
          <li>The Operator is not liable for any damages arising from use of the Service.</li>
          <li>The Operator is not liable for disputes between users or between users and third parties.</li>
          <li>The Operator is not liable for data loss or corruption. Regular backups are recommended.</li>
        </ol>
      </Section>

      <Section title="Article 10 (Limitation of Liability)">
        <p>
          If damages occur due to the Operator's fault, the Operator's liability is limited to
          the total amount of fees paid by the user in the past 12 months.
        </p>
      </Section>

      <Section title="Article 11 (Changes to Terms)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>The Operator may change these Terms as necessary.</li>
          <li>Revised Terms take effect when posted on the Service.</li>
          <li>Significant changes will be notified in advance via email or other means.</li>
          <li>Continued use of the Service after changes constitutes acceptance of the revised Terms.</li>
        </ol>
      </Section>

      <Section title="Article 12 (Personal Information)">
        <p>
          For information on personal data handling, please refer to our{' '}
          <Link to="/legal/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section title="Article 13 (Governing Law and Jurisdiction)">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>These Terms are governed by the laws of Japan.</li>
          <li>The Yokohama District Court shall have exclusive jurisdiction as the court of first instance for any disputes related to the Service.</li>
        </ol>
      </Section>

      <Section title="Contact">
        <p>
          For questions about these Terms, please contact:
        </p>
        <p className="mt-2 text-gray-700">
          Email: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
