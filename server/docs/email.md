# Transactional email and deliverability

The API sends mail with Nodemailer ([`src/services/emailService.js`](../src/services/emailService.js)). If messages land in **spam**, fix **DNS authentication** and **sender alignment** first; code changes are secondary.

## Quick checklist

1. **SPF** — Add a TXT record on your **sending domain** that lists the servers allowed to send (your SMTP provider’s instructions). One typo breaks delivery.

2. **DKIM** — Add the TXT or CNAME record your provider shows. Signing proves the message was authorized by your domain.

3. **DMARC** — Start with monitoring only, then tighten.
   - Host: `_dmarc.yourdomain.com` (TXT)
   - Example: `v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com`
   - After SPF and DKIM pass reliably, consider `p=quarantine` or `p=reject`.

4. **`EMAIL_FROM`** — Use an address on the **same domain** you authenticated (e.g. `BPC League <noreply@yourdomain.com>`). A visible From on `gmail.com` while SMTP signs `yourdomain.com` (or the reverse) hurts alignment.

5. **`EMAIL_REPLY_TO`** — Optional; set to a monitored address (e.g. support) so recipients can reply without using `noreply` as the reply target.

6. **Provider** — For production OTP and admin mail, prefer a **transactional** provider (Resend, Postmark, SendGrid, Amazon SES, Mailgun) over consumer Gmail + app passwords. Most provide SMTP; point `SMTP_*`, `EMAIL_USER`, and `EMAIL_PASS` at their docs.

## Verify

- Send a test to [Mail-Tester](https://www.mail-tester.com/) (or similar) and fix every SPF/DKIM/DMARC warning until the score is green.
- Check your provider’s dashboard for domain verification and bounces.

## References

- See [`../.env.example`](../.env.example) for example SMTP settings (Gmail, Resend, Postmark).
