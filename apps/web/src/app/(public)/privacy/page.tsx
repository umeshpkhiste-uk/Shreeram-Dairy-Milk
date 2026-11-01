import type { Metadata } from 'next';
import Link from 'next/link';

import { CONTACT_EMAIL } from '@/lib/public-contact';

export const metadata: Metadata = {
  title: 'Privacy Policy — Shreeram Doodh Diary & Sweets',
  description: 'How the Shreeram Doodh Diary & Sweets staff app collects, uses and protects data.',
};

// Keep in sync with docs/play-store/privacy-policy.md (the Play Console source of truth).
export default function PrivacyPolicyPage() {
  return (
    <>
      <div>
        <h1>Privacy Policy</h1>
        <p className="text-text-secondary">Last updated: 2 November 2026</p>
      </div>

      <p>
        Shreeram Doodh Diary &amp; Sweets (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs the{' '}
        <strong>Shreeram Doodh Diary &amp; Sweets</strong> Android app and this admin website. The
        app is used only by our own staff — delivery workers and administrators — to manage daily
        milk deliveries, one-time orders, and monthly bills. There is no public sign-up; accounts
        are created by our administrator.
      </p>

      <section>
        <h2>Information we collect</h2>
        <p className="font-medium">About staff who use the app (workers and administrators)</p>
        <ul>
          <li>Name, email address and phone number, used to create and identify your account.</li>
          <li>Your sign-in session, stored securely on your phone so you stay signed in.</li>
          <li>
            The deliveries you record (customer, date, quantity, status, optional note, and the
            time your phone recorded it).
          </li>
        </ul>
        <p className="mt-3 font-medium">
          About our customers (entered by our staff, not by the customers themselves)
        </p>
        <ul>
          <li>Name, mobile number, optional email, delivery address, locality and landmark.</li>
          <li>Milk type, daily quantity, route, delivery start date, and any notes.</li>
          <li>
            Delivery records, one-time orders, monthly bills, adjustments and payments received
            (amount, method such as cash/UPI/bank transfer, and reference).
          </li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> collect location, contacts, photos, camera or microphone
          access, device advertising IDs, or browsing activity. The app contains no advertising and
          no analytics or crash-reporting tools.
        </p>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          Only to run the dairy&rsquo;s delivery and billing operations: showing each worker their
          route, recording deliveries, calculating and sharing monthly bills, tracking payments,
          and producing business reports. We never sell this information or use it for
          advertising.
        </p>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>
            <strong>Delivery workers</strong> see only the customers assigned to them and the
            deliveries and orders they need to fulfil. Workers never see prices, bills or payments.
          </li>
          <li>
            <strong>Administrators</strong> see all business records.
          </li>
          <li>Access rules are enforced on the server, not just in the app.</li>
        </ul>
        <p className="mt-3">
          We do not share personal information with third parties, except the service providers
          that host the app&rsquo;s data on our behalf: <strong>Supabase</strong> (database and
          sign-in; servers in Seoul, South Korea) and <strong>Vercel</strong> (hosts this
          website). When an administrator shares a bill or report as a PDF, it is sent through the
          phone&rsquo;s own share sheet (for example WhatsApp or email), only to the recipient they
          choose.
        </p>
      </section>

      <section>
        <h2>Storage on your phone</h2>
        <p>
          To work without network coverage, the app keeps a copy of your assigned customers and the
          deliveries you recorded on the phone, and syncs them to our server when you&rsquo;re
          online. This data is removed when you sign out or uninstall the app.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          All data is sent over encrypted connections (HTTPS). Sign-in sessions are stored in the
          phone&rsquo;s secure storage. Each account can only access what its role allows.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          Staff accounts are kept while you work with us. Delivery and billing records are kept for
          as long as needed for accounting and legal purposes. To delete your account or request
          deletion of your data, follow the steps on the{' '}
          <Link href="/delete-account">account deletion page</Link> or email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Records we must keep for
          accounting (for example, bills already issued and payments received) may be retained in
          anonymised or restricted form. Customers can ask us to correct or delete their details
          the same way.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>The app is for adult staff of the business and is not directed at children under 18.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We&rsquo;ll update this page if our practices change and revise the date above.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Shreeram Doodh Diary &amp; Sweets, R9 Sector, Life Republic, Kolte Patil.
          <br />
          Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </section>
    </>
  );
}
