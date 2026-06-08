# Phase 1 — Player accounts (setup)

## Database

```bash
cd server && npm run migrate
```

Migration `025_player_accounts.sql` is additive only.

## Link Season 1 registrations

```bash
cd server
node scripts/migrate-s1-to-player-accounts.js --dry-run
node scripts/migrate-s1-to-player-accounts.js --apply
```

## Environment (`server/.env`)

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Frontend origin (e.g. `http://localhost:5173`) |
| `API_PUBLIC_URL` | API origin for OAuth callbacks (e.g. `http://localhost:3000`) |
| `PLAYER_TOKEN_SECRET` | Sessions + email tokens (optional; falls back to `REGISTRATION_OTP_SECRET`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord link |
| `STEAM_API_KEY` | Steam profile after OpenID link |
| `EMAIL_SKIP_SEND=true` | Dev: verification/reset URLs returned in API JSON |

## OAuth redirect URLs (register in each provider)

- Google: `{API_PUBLIC_URL}/api/player/auth/google/callback`
- Discord: `{API_PUBLIC_URL}/api/player/auth/discord/callback`
- Steam OpenID return: `{API_PUBLIC_URL}/api/player/auth/steam/callback`

## Frontend routes

- `/signup`, `/login`, `/verify-email`, `/auth/callback`
- `/dashboard` — eligibility checklist
- `/player/:slug` — public profile stub
- `/forgot-password`, `/reset-password`

Google OAuth creates a new account when the Google email is not yet registered (no verification email required). Email/password signup still requires verify.

Player token: `localStorage` key `bpcl-player-token`.

## Dev test flow

1. Start API + Vite (`server`: `npm run dev`, `dota`: `npm run dev`).
2. Sign up at `/signup` (use `EMAIL_SKIP_SEND` to get verify link in response).
3. Open verify link → lands on dashboard with session.
4. Link Steam / Discord from dashboard (must be logged in).
5. Admin CRM shows global `playerBpcId` + profile link when linked.
