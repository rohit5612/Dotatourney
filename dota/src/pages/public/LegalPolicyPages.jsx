import {
  CANCELLATION_REQUEST_WINDOW_HOURS,
  LEGAL_REGISTRATION_FEE_INR,
  OPERATOR_FULL_NAME,
  PUBLIC_CONTACT_EMAIL,
  REFUND_REQUEST_WINDOW_DAYS,
  TRADE_NAME,
} from "../../constants/legal.js";
import { SITE_BRAND_FULL, SITE_BRAND_SHORT, SITE_ORIGIN } from "../../constants/siteMeta.js";
import { LegalExternalLink, LegalLink, LegalPageLayout, LegalSection } from "../../components/legal/LegalPageLayout.jsx";

const LAST_UPDATED = "June 2026";

function ServicesPricingTable() {
  return (
    <div className="legal-page__table-wrap">
      <table className="legal-page__table">
        <thead>
          <tr>
            <th scope="col">Service / product</th>
            <th scope="col">Description</th>
            <th scope="col">Price (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tournament player registration</td>
            <td>
              Confirms your player slot for an active {SITE_BRAND_SHORT} season or event, including
              bracket eligibility, roster workflow access, and organizer communications through the
              platform and Discord.
            </td>
            <td>
              ₹{LEGAL_REGISTRATION_FEE_INR} per player (or the amount shown at checkout for the
              active tournament)
            </td>
          </tr>
          <tr>
            <td>Substitute pool enrollment</td>
            <td>
              Optional waitlist for match-day substitute assignments when the main roster is full.
              No guaranteed slot; admins assign subs for specific matches only.
            </td>
            <td>₹0 (free)</td>
          </tr>
          <tr>
            <td>Player account &amp; dashboard access</td>
            <td>
              Profile management, registration status, schedule visibility, notifications, and
              tournament history on the website.
            </td>
            <td>Included with registration (no separate charge)</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function TermsAndConditionsPage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Terms & Conditions"
      subtitle={`This website is operated by ${TRADE_NAME}.`}
      meta={`Last updated ${LAST_UPDATED}. Applies to ${SITE_ORIGIN} and related registration services.`}
      footerNote={`Questions about these terms? Email ${PUBLIC_CONTACT_EMAIL}.`}
    >
      <LegalSection title="1. Agreement to terms" accent>
        <p>
          By accessing this website, creating a player account, or paying for registration, you
          agree to these Terms &amp; Conditions, our{" "}
          <LegalLink to="/privacy">Privacy Policy</LegalLink>,{" "}
          <LegalLink to="/refund-policy">Return &amp; Refund Policy</LegalLink>, and{" "}
          <LegalLink to="/cancellation-policy">Cancellation Policy</LegalLink>.
        </p>
        <p>
          If you do not agree, please do not use the site or complete a paid registration.
        </p>
      </LegalSection>

      <LegalSection title="2. Operator and website">
        <p>
          <strong>Trade name:</strong> {TRADE_NAME}
        </p>
        <p>
          <strong>Full name:</strong> {OPERATOR_FULL_NAME}
        </p>
        <p>
          {TRADE_NAME} operates {SITE_BRAND_FULL} ({SITE_BRAND_SHORT}) as a digital tournament
          platform for Dota 2 event registrations, player onboarding, schedules, and competition
          updates. This is a community-run tournament and is not affiliated with Valve Corporation.
        </p>
      </LegalSection>

      <LegalSection title="3. Products and services (INR pricing)">
        <p>
          All paid services on this website are quoted and charged in{" "}
          <strong>Indian Rupees (INR)</strong>. The final payable amount is always displayed on the
          checkout screen before you confirm payment.
        </p>
        <ServicesPricingTable />
        <p>
          Prices may differ between seasons or tournaments. Any promotional discounts or BPC coin
          offsets applied at checkout will be reflected in the order summary before payment.
        </p>
      </LegalSection>

      <LegalSection title="4. Registration and eligibility">
        <ul>
          <li>You must provide accurate personal, contact, and game-related details during signup.</li>
          <li>
            You must comply with published{" "}
            <LegalLink to="/rules">rules and player conduct</LegalLink> for each event you enter.
          </li>
          <li>
            Registration is confirmed only after successful payment and admin approval where
            applicable. Payment alone does not guarantee participation if eligibility requirements
            are not met.
          </li>
          <li>
            We may reject, suspend, or remove registrations for false information, policy violations,
            cheating, harassment, or abuse of the platform.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Payments">
        <p>
          Payments are processed through authorised payment gateways (for example Razorpay or PayU).
          You agree to provide valid payment details and authorise charges for the amount shown at
          checkout. Failed or reversed transactions may result in registration being withheld until
          payment is successfully completed.
        </p>
        <p>
          You are responsible for any bank charges, currency conversion fees, or network declines
          imposed by your payment provider outside our control.
        </p>
      </LegalSection>

      <LegalSection title="6. User conduct">
        <p>You agree not to:</p>
        <ul>
          <li>Submit fraudulent payment proofs, chargebacks without valid cause, or impersonate others.</li>
          <li>Attempt to disrupt brackets, schedules, admin tools, or other users&apos; access.</li>
          <li>Scrape, reverse-engineer, or misuse APIs or data exposed on the public site.</li>
          <li>Use the platform for unlawful purposes or to harass staff, players, or volunteers.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Intellectual property">
        <p>
          Site branding, layout, and original content are owned by the operator or licensors.
          Dota 2 and related marks are property of Valve Corporation. User-submitted content (such
          as profile details or uploaded payment screenshots) remains yours, but you grant us a
          limited licence to use it for tournament operations and verification.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>
          The platform is provided on an &quot;as is&quot; basis. To the fullest extent permitted by
          law, {TRADE_NAME} is not liable for indirect, incidental, or consequential losses arising
          from site downtime, third-party service failures, match scheduling changes, or event
          cancellations beyond reasonable control.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes and governing law">
        <p>
          We may update these terms when services, pricing, or legal requirements change. Continued
          use after updates constitutes acceptance of the revised terms. These terms are governed by
          the laws of India. Disputes should first be raised via{" "}
          <a className="legal-page__link" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
            {PUBLIC_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

export function ReturnRefundPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Return & Refund Policy"
      subtitle="Duration, eligibility, and refund mode for registration payments."
      meta={`Last updated ${LAST_UPDATED}. Operated by ${TRADE_NAME}.`}
      footerNote={`Refund requests: ${PUBLIC_CONTACT_EMAIL} (include payment reference and registered email).`}
    >
      <LegalSection title="1. Nature of services" accent>
        <p>
          {SITE_BRAND_SHORT} sells digital tournament registration services, not physical goods.
          Because access to event participation is reserved upon successful registration,{" "}
          <strong>product returns are not applicable</strong>. Refunds are handled under the
          conditions below instead of a traditional return process.
        </p>
      </LegalSection>

      <LegalSection title="2. Refund duration">
        <p>
          You may request a refund within{" "}
          <strong>{REFUND_REQUEST_WINDOW_DAYS} calendar days</strong> from the date of successful
          payment, provided that:
        </p>
        <ul>
          <li>Your registration has not been used for bracket seeding or match assignment.</li>
          <li>Admins have not marked your registration as approved and locked for the event.</li>
          <li>You have not violated tournament rules leading to removal.</li>
          <li>The event has not already started for your registered division.</li>
        </ul>
        <p>
          Requests received after this window, or after your slot has been utilised, are generally
          not eligible unless required by applicable law or explicitly approved by organisers.
        </p>
      </LegalSection>

      <LegalSection title="3. Refund mode">
        <p>
          Approved refunds are processed to the <strong>original payment method</strong> used at
          checkout (same card, UPI, net banking, or wallet account where technically possible).
        </p>
        <ul>
          <li>
            <strong>Processing time:</strong> 5–10 business days after approval, depending on your
            bank or payment network.
          </li>
          <li>
            <strong>Partial refunds:</strong> If only part of a composite checkout is refundable
            (for example after partial service delivery), we will refund the eligible INR amount
            only.
          </li>
          <li>
            <strong>Failed reversals:</strong> If the original channel cannot accept a reversal, we
            may offer an alternative verified method at our discretion.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Non-refundable situations">
        <ul>
          <li>Registrations approved and locked into an active roster after the refund window.</li>
          <li>Player removal for misconduct, cheating, or rule violations.</li>
          <li>Voluntary withdrawal after brackets are published or matches are scheduled.</li>
          <li>Chargebacks filed without contacting organisers first may be disputed with evidence.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Event cancellation by organiser">
        <p>
          If an event is cancelled before it begins and you have a valid paid registration, you will
          receive a full refund of the registration fee in INR via the original payment method, or
          credit toward a future season if you prefer and organisers offer that option.
        </p>
      </LegalSection>

      <LegalSection title="6. How to request a refund">
        <ol>
          <li>
            Email <a className="legal-page__link" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>{" "}
            from your registered account email.
          </li>
          <li>Include your full name, tournament/season name, payment date, and transaction reference.</li>
          <li>State the reason for your request.</li>
          <li>We will confirm eligibility within 3 business days and initiate approved refunds promptly.</li>
        </ol>
        <p>
          See also our <LegalLink to="/cancellation-policy">Cancellation Policy</LegalLink> for
          time limits on withdrawal before bracket lock-in.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

export function CancellationPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Cancellation Policy"
      subtitle="How and when you may cancel a registration request."
      meta={`Last updated ${LAST_UPDATED}. Cancellation window: ${CANCELLATION_REQUEST_WINDOW_HOURS} hours from payment.`}
      footerNote={`Cancellation requests: ${PUBLIC_CONTACT_EMAIL}.`}
    >
      <LegalSection title="1. What cancellation means" accent>
        <p>
          Cancellation means you withdraw your registration request before your player slot is
          finalised for competition. Once cancelled and approved, you will not be listed on the
          event roster and refund handling follows our{" "}
          <LegalLink to="/refund-policy">Return &amp; Refund Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="2. Cancellation duration">
        <p>
          You may request cancellation within{" "}
          <strong>{CANCELLATION_REQUEST_WINDOW_HOURS} hours</strong> of successful payment,
          subject to all of the following:
        </p>
        <ul>
          <li>Bracket allocation or final roster lock-in has not yet occurred for your slot.</li>
          <li>Admins have not completed verification that binds you to the active event roster.</li>
          <li>The registration window for your division remains open, or organisers approve an exception.</li>
        </ul>
        <p>
          After this period, cancellation is at the organiser&apos;s discretion and may be treated
          as a refund request under the {REFUND_REQUEST_WINDOW_DAYS}-day refund policy instead.
        </p>
      </LegalSection>

      <LegalSection title="3. How to cancel">
        <ol>
          <li>
            Send a cancellation request to{" "}
            <a className="legal-page__link" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>{" "}
            from your registered email address.
          </li>
          <li>Include your player name, season/tournament, and payment reference.</li>
          <li>We will confirm cancellation status by email within 2 business days.</li>
        </ol>
        <p>
          You may also contact organisers on the official Discord server linked from the website for
          urgent match-day issues, but written email is required for refund processing.
        </p>
      </LegalSection>

      <LegalSection title="4. After cancellation is approved">
        <p>
          Approved cancellations stop further use of your registration slot. Eligible payments are
          refunded to the <strong>original payment method in INR</strong> within 5–10 business
          days after approval, unless you and organisers agree on an alternative such as transfer to
          a future season.
        </p>
      </LegalSection>

      <LegalSection title="5. Cancellations we may initiate">
        <p>We may cancel your registration without a refund if:</p>
        <ul>
          <li>Payment is reversed, disputed fraudulently, or found to be invalid.</li>
          <li>You breach eligibility requirements or tournament rules.</li>
          <li>Required verification (identity, Steam, Discord, or payment proof) is not completed in time.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Related policies">
        <p>
          For broader terms governing use of the website, see{" "}
          <LegalLink to="/terms">Terms &amp; Conditions</LegalLink>. For data handling, see{" "}
          <LegalLink to="/privacy">Privacy Policy</LegalLink>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

export function AboutUsPage() {
  return (
    <LegalPageLayout
      eyebrow="About"
      title="About Us"
      subtitle={`${SITE_BRAND_FULL} — community Dota 2 tournament platform.`}
      meta={`Operated by ${TRADE_NAME} (${OPERATOR_FULL_NAME}).`}
    >
      <LegalSection title="Who we are" accent>
        <p>
          <strong>Trade name:</strong> {TRADE_NAME}
        </p>
        <p>
          <strong>Full name:</strong> {OPERATOR_FULL_NAME}
        </p>
        <p>
          We run {SITE_BRAND_SHORT} as a dedicated hub for Indian Dota 2 tournament registrations,
          rosters, brackets, schedules, and match-day communication. The platform helps players sign
          up, pay registration fees in INR, and stay informed throughout each season.
        </p>
      </LegalSection>

      <LegalSection title="What we offer">
        <ul>
          <li>Online player registration and secure INR checkout for active tournaments.</li>
          <li>Player dashboards for profile settings, notifications, and registration status.</li>
          <li>Public schedules, team listings, standings, and announcements.</li>
          <li>Substitute pool enrollment when main rosters are full.</li>
          <li>Community support through Discord and published news updates.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Pricing transparency">
        <p>
          Registration fees are published on the tournament page and confirmed again at checkout.
          Current standard registration is <strong>₹{LEGAL_REGISTRATION_FEE_INR} INR</strong> per
          player for active seasons unless a different amount is displayed for a specific event.
        </p>
        <ServicesPricingTable />
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          <strong>Email:</strong>{" "}
          <a className="legal-page__link" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </p>
        <p>
          <strong>Website:</strong>{" "}
          <LegalExternalLink href={SITE_ORIGIN}>{SITE_ORIGIN}</LegalExternalLink>
        </p>
        <p>
          <strong>Community:</strong>{" "}
          <LegalExternalLink href="https://discord.gg/sV2PhYc6A3">Join our Discord server</LegalExternalLink>
        </p>
      </LegalSection>

      <LegalSection title="Legal information">
        <p>
          Read our <LegalLink to="/terms">Terms &amp; Conditions</LegalLink>,{" "}
          <LegalLink to="/privacy">Privacy Policy</LegalLink>,{" "}
          <LegalLink to="/refund-policy">Return &amp; Refund Policy</LegalLink>, and{" "}
          <LegalLink to="/cancellation-policy">Cancellation Policy</LegalLink> for full details on
          payments, refunds, and data use.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
