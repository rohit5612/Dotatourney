# Frontend (Vite)

This app uses `VITE_API_BASE_URL` to decide where API requests are sent.

## Environment variables

Copy `.env.example` to `.env` and adjust values as needed.

- `VITE_API_BASE_URL`
  - Used by the frontend at runtime for every API request.
  - Default in code is `/api`.
  - Production (bpcleague.in): keep `/api` — Netlify proxies those requests to the VPS (`netlify.toml`).

- `VITE_API_PROXY_TARGET`
  - Used only by the Vite dev server proxy.
  - Default: `http://localhost:3000`

## Local development

Keep `VITE_API_BASE_URL=/api` and run the backend on `http://localhost:3000`.
Vite will proxy `/api` requests to the backend in development mode.

## Production (Netlify + Hostinger VPS — bpcleague.in)

Set `VITE_API_BASE_URL=/api` and `VITE_API_PUBLIC_URL=https://api.bpcleague.in` at **build time** on Netlify (see `dota/.env.example` and `docs/deploy-bpcleague.md`). On the server, set `CORS_ORIGIN` and `APP_URL` to `https://bpcleague.in`.
