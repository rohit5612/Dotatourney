# bpcleague.com production deploy (Hostinger VPS)

## Stack

- Nginx serves `dota/dist` and proxies `/api` → `127.0.0.1:3000`
- PM2 runs `server/src/index.js`
- PostgreSQL on localhost only

## Deploy steps

```bash
git pull origin season2
cd server && npm ci && npm run migrate
cd ../dota && npm ci && npm run build
pm2 reload bpcl-api
```

## Environment

- Server: see `server/.env.example` (Razorpay live keys, OAuth callbacks for `https://bpcleague.com`)
- Frontend build: `dota/.env.production` with `VITE_EMERALD_THEME=true` when launching emerald UI

## Razorpay webhook

`POST https://bpcleague.com/api/webhooks/razorpay`

## Overlay / Discord (Phase 7)

- Card API: `docs/overlay-api.md`
- Discord bot: assign roles on paid registration tier (configure `DISCORD_BOT_TOKEN` when ready)
