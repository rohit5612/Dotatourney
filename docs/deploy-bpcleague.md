# bpcleague.in production deploy

Manual hosting guide for **Netlify (frontend)** + **Hostinger VPS (API + PostgreSQL)** + **Upstash Redis**.

## Architecture

| URL | Host | Role |
|-----|------|------|
| `https://bpcleague.in` | Netlify | React SPA (`dota/dist`) |
| `https://www.bpcleague.in` | Netlify | 301 → apex |
| `https://api.bpcleague.in` | Hostinger VPS | Express API, OAuth callbacks, Cashfree webhook |

---

## Step 1 — Hostinger VPS setup

1. Order Ubuntu 22.04 VPS (2 GB+ RAM recommended).
2. SSH in, create deploy user, enable UFW:
   ```bash
   ufw allow OpenSSH
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```
3. Install: `git`, `curl`, `build-essential`, `nginx`, `certbot`, `python3-certbot-nginx`
4. Install Node 20 LTS and PM2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```

---

## Step 2 — PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql
```

```sql
CREATE USER bpcl WITH PASSWORD 'your-strong-password';
CREATE DATABASE bpcl OWNER bpcl;
\q
```

Ensure Postgres listens on `127.0.0.1` only. Connection string:

```
DATABASE_URL=postgresql://bpcl:your-strong-password@127.0.0.1:5432/bpcl
```

---

## Step 3 — Deploy API code

```bash
sudo mkdir -p /var/www/bpcl
sudo chown $USER:$USER /var/www/bpcl
git clone <your-repo-url> /var/www/bpcl
cd /var/www/bpcl/server
cp .env.example .env
# Edit .env — see "Environment variables" below
npm ci
npm run migrate
pm2 start src/index.js --name bpcl-api
pm2 save
pm2 startup
```

Verify locally on VPS:

```bash
curl http://127.0.0.1:3000/health
# → {"ok":true}
```

---

## Step 4 — Upstash Redis (free tier)

1. Create a database at [upstash.com](https://upstash.com) (region near your VPS, e.g. `ap-south-1`).
2. Copy **REST URL** and **REST token** into `server/.env`:
   ```env
   UPSTASH_REDIS_REST_URL=https://....upstash.io
   UPSTASH_REDIS_REST_TOKEN=...
   ```
3. `pm2 reload bpcl-api` — startup log should show Upstash Redis connected.

---

## Step 5 — Nginx + SSL for API

Create `/etc/nginx/sites-available/api.bpcleague.in`:

```nginx
server {
  listen 80;
  server_name api.bpcleague.in;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20m;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api.bpcleague.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.bpcleague.in
```

Test: `curl https://api.bpcleague.in/health`

---

## Step 6 — GoDaddy DNS

| Type | Name | Value |
|------|------|-------|
| A | `api` | `<VPS_PUBLIC_IP>` |
| — | `@` | Netlify apex (see Step 7) |
| CNAME | `www` | `<your-site>.netlify.app` |

Optional email (OTP / invites): SPF, DKIM, DMARC for `bpcleague.in` — see `server/docs/email.md`.

---

## Step 7 — Netlify frontend

1. Connect repo in Netlify.
2. Build settings (or use repo `dota/netlify.toml`):
   - Base directory: `dota`
   - Build: `npm ci && npm run build`
   - Publish: `dist`
3. **Environment variables** (Site settings → Environment):

   ```env
   VITE_API_BASE_URL=https://api.bpcleague.in/api
   VITE_API_PUBLIC_URL=https://api.bpcleague.in
   VITE_SITE_URL=https://bpcleague.in
   VITE_EMERALD_THEME=true
   ```

4. Add custom domains: `bpcleague.in` + `www.bpcleague.in`
5. Set primary domain to `bpcleague.in`
6. Add GoDaddy DNS records Netlify shows for apex + www
7. Enable HTTPS (automatic)

---

## Step 8 — Server environment (`server/.env`)

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://bpcl:PASSWORD@127.0.0.1:5432/bpcl

CORS_ORIGIN=https://bpcleague.in,https://www.bpcleague.in
APP_URL=https://bpcleague.in
API_PUBLIC_URL=https://api.bpcleague.in

REGISTRATION_OTP_SECRET=<long-random-string>
PLAYER_TOKEN_SECRET=<long-random-string>

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
STEAM_API_KEY=...

UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_FROM="BPC League" <noreply@bpcleague.in>

CASHFREE_CLIENT_ID=
CASHFREE_CLIENT_SECRET=
CASHFREE_ENV=production
```

After editing: `pm2 reload bpcl-api`

---

## Step 9 — OAuth & payment provider consoles

Register these **exact** URLs:

| Provider | Setting | URL |
|----------|---------|-----|
| Google | Authorized JavaScript origins | `https://bpcleague.in`, `https://www.bpcleague.in` |
| Google | Authorized redirect URI | `https://api.bpcleague.in/api/player/auth/google/callback` |
| Discord | OAuth2 redirect | `https://api.bpcleague.in/api/player/auth/discord/callback` |
| Steam | `API_PUBLIC_URL` must be | `https://api.bpcleague.in` (no trailing slash) |
| Cashfree | Webhook | `https://api.bpcleague.in/api/webhooks/cashfree` |

Keep localhost URLs for dev (`http://localhost:3000/api/player/auth/*/callback`).

---

## Step 10 — Go-live checklist

- [ ] `curl https://api.bpcleague.in/health` returns `{"ok":true}`
- [ ] `https://bpcleague.in` loads the site
- [ ] `https://www.bpcleague.in` redirects to apex
- [ ] Browser DevTools: API calls to `api.bpcleague.in` succeed (no CORS errors)
- [ ] Google login on `/login` → lands on `/dashboard`
- [ ] Discord link from profile/settings works
- [ ] Steam link from profile/settings works
- [ ] Admin invite email links open `https://bpcleague.in/admin/...`
- [ ] `https://bpcleague.in/robots.txt` and `/sitemap.xml` load
- [ ] Submit sitemap in [Google Search Console](https://search.google.com/search-console)
- [ ] `/whats-new` loads tier comparison with live prices from API
- [ ] `/dashboard/checkout/:slug` — card preview images load from `/cards/previews/`
- [ ] Cashfree checkout opens (inline modal); return URL `/dashboard/checkout/return` works
- [ ] Cashfree webhook delivers at `https://api.bpcleague.in/api/webhooks/cashfree`

---

## Cards, checkout previews & Cashfree (Season 2)

### Database migrations (API deploy)

Run after pulling card/checkout changes:

```bash
cd server && npm run migrate
```

Key migrations: `046_cashfree_checkout.sql`, `048_player_card_payload.sql`, `049_card_tier_override.sql`.

### Static card assets (Netlify / `dota/public`)

Ship these with the frontend build:

| Path | Purpose |
|------|---------|
| `cards/gold/frame.png`, `cards/holo/frame.png`, `cards/player/frame-base.png` | Live card frames |
| `cards/gifs/` | Holo portrait GIFs |
| `cards/defaultlogo.png` | Default card logo |
| `cards/previews/default.png`, `player.png`, `gold.png`, `holo.png` | Checkout + What's New screenshot previews |
| `cards/overlay/{steam32}.png` / `{steam32}.webm`, `cards/overlay/index.json` | Pre-rendered player cards for GSI overlay (generated via `npm run export-overlay-cards` in `server/`) |

**Generate overlay cards (VPS or local machine):**

```bash
cd server
npm ci
npx playwright install chromium
# On Ubuntu/Debian VPS — required once; fixes missing libatk / shared-library errors:
sudo npx playwright install-deps chromium
npm run export-overlay-cards
```

Output: `dota/public/cards/overlay/`. Commit and push so Netlify serves them at `https://bpcleague.in/cards/overlay/`.

### Cashfree (server `.env`)

| Variable | Notes |
|----------|-------|
| `APP_URL` | Frontend origin — used for `return_url` → `{APP_URL}/dashboard/checkout/return?orderId=...` |
| `CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` | From Cashfree dashboard |
| `CASHFREE_ENV` | `production` for go-live; omit keys locally → manual/simulate checkout |

**Cashfree dashboard:** webhook `https://api.bpcleague.in/api/webhooks/cashfree`

Without Cashfree keys, checkout uses `manual` provider (dev only).

### Content Security Policy (if enforced)

Allow Cashfree SDK at runtime:

```
script-src https://sdk.cashfree.com
```

Add via Netlify `_headers` or site config if checkout fails to load the payment widget.

---

## Ongoing deploys

**API (VPS):**
```bash
cd /var/www/bpcl && git pull
cd server && npm ci && npm run migrate
pm2 reload bpcl-api
```

**Frontend:** push to main → Netlify auto-builds (or trigger deploy manually).

**Backups:** daily `pg_dump` cron to off-VPS storage.

---

## Overlay API

Card/overlay endpoints: `https://api.bpcleague.in/api/public` — see `server/docs/overlay-api.md`.
