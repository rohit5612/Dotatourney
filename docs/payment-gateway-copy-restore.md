# Payment gateway copy — removed for manual UPI (restore checklist)

When re-enabling `PAYMENT_MODE=gateway` and public Cashfree checkout, restore the **original** strings below (search this file by path).

| File | Location / context | Original copy (restore) |
|------|-------------------|------------------------|
| `dota/src/components/player/PlayerAuthShell.jsx` | `AUTH_HIGHLIGHTS` id `payments` | `Secure payment gateway for deposits & withdrawals` |
| `dota/src/pages/public/LegalPolicyPages.jsx` | Terms §5 Payments, first paragraph | `Payments are processed through authorised payment gateways (for example Cashfree).` |
| `dota/src/pages/PublicPages.jsx` | Privacy §2 Payment data | `Transaction references and payment status from our payment gateway.` |
| `dota/src/pages/PublicPages.jsx` | Privacy §5 Sharing | `Payment processors (such as Cashfree) to complete INR transactions.` |
| `dota/src/pages/public/WhatsNewPage.jsx` | Release summary | `online checkout` (in Hostinger deployment bullet) |
| `dota/src/pages/public/WhatsNewSeason2Content.jsx` | Register step copy | `pay online in one checkout flow` |
| `dota/src/pages/public/WhatsNewSeason2Content.jsx` | Intro band | `No separate OTP forms or manual payment screenshots — tournament registration runs entirely through your account.` |
| `dota/src/admin/setup/TournamentDraftModal.jsx` | Cards hint | `Registration fees and Cashfree checkout are configured in the Cards tab.` |
| `dota/src/components/player/DashboardCheckout.jsx` | Confirming state | `Confirming your payment with Cashfree…` |
| `dota/src/pages/player/PlayerCheckoutPage.jsx` | Confirming state | `Confirming your payment with Cashfree…` |
| `dota/src/components/player/CardUpgradeModal.jsx` | Confirming state | `Confirming your payment with Cashfree…` |
| `dota/src/components/payment/CashfreeGatewayModal.jsx` | Error fallback | `Could not open payment gateway.` |
| `server/src/services/emailService.js` | Sponsor receipt footer (HTML + text) | `Gateway: ${provider}` |
| `server/src/services/paymentProvider.js` | 503 error message | `configure Cashfree for gateway mode` |
| `dota/src/lib/cashfreeCheckout.js` | Script load errors | `Failed to load Cashfree` |
| `dota/src/admin/setup/RegistrationControlsModal.jsx` | Open hint | `Players can complete checkout on the public registration page.` |

**Not changed (implementation only, not marketing copy):** `CashfreeGatewayModal`, `cashfreeCheckout.js`, webhook routes, env `CASHFREE_*`, admin reconcile scripts.

**Date removed:** 2026-03-25 — manual UPI / legal review.
