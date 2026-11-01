import type { Metadata } from 'next';

import { CONTACT_EMAIL } from '@/lib/public-contact';

export const metadata: Metadata = {
  title: 'Delete your account — Shreeram Doodh Diary & Sweets',
  description:
    'How to request deletion of your Shreeram Doodh Diary & Sweets app account and data.',
};

const MAIL_SUBJECT = encodeURIComponent('Account deletion request — Shreeram Doodh Diary & Sweets');

export default function DeleteAccountPage() {
  return (
    <>
      <div>
        <h1>Delete your account</h1>
        <p className="text-text-secondary">
          For the <strong>Shreeram Doodh Diary &amp; Sweets</strong> Android app, by Shreeram Doodh
          Diary &amp; Sweets.
        </p>
      </div>

      <section>
        <h2>How to request deletion</h2>
        <ol>
          <li>
            Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=${MAIL_SUBJECT}`}>{CONTACT_EMAIL}</a> from
            the email address you sign in to the app with (or tell the business administrator in
            person).
          </li>
          <li>Write &ldquo;Delete my account&rdquo; and include your name and phone number.</li>
          <li>
            We confirm your identity and complete the request within <strong>30 days</strong>, and
            reply to tell you it&rsquo;s done.
          </li>
        </ol>
        <p className="mt-3">
          You can also ask us to delete only some of your data without closing your account — use
          the same email and say what you want removed.
        </p>
      </section>

      <section>
        <h2>What is deleted</h2>
        <ul>
          <li>Your sign-in account (email and password) — you can no longer sign in.</li>
          <li>Your name, email address and phone number on your staff profile.</li>
          <li>
            Any data stored on your phone by the app — this is also removed as soon as you sign out
            or uninstall the app.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we keep, and for how long</h2>
        <p>
          Delivery records, bills and payment records are business accounting records. We keep
          them for as long as required for accounting and tax purposes, with your personal details
          removed or replaced by an anonymous label where the record must remain. They are visible
          only to the business administrator.
        </p>
      </section>

      <section>
        <h2>Customers</h2>
        <p>
          If you are a Shreeram customer (not staff) and want your details corrected or deleted,
          email the same address with your name and registered mobile number.
        </p>
      </section>
    </>
  );
}
