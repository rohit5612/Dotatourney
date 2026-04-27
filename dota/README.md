# Frontend (Vite)

This app uses `VITE_API_BASE_URL` to decide where API requests are sent.

## Environment variables

Copy `.env.example` to `.env` and adjust values as needed.

- `VITE_API_BASE_URL`
  - Used by the frontend at runtime for every API request.
  - Default in code is `/api`.
  - For production hosting, set this to your backend origin plus `/api` when frontend and backend are on different domains.
    - Example: `VITE_API_BASE_URL=https://api.example.com/api`

- `VITE_API_PROXY_TARGET`
  - Used only by the Vite dev server proxy.
  - Default: `http://localhost:3000`

## Local development

Keep `VITE_API_BASE_URL=/api` and run the backend on `http://localhost:3000`.
Vite will proxy `/api` requests to the backend in development mode.

## Production (e.g. Render + EC2)

Set `VITE_API_BASE_URL` at **build time** on Render to your EC2 API origin, including the `/api` prefix (see `dota/.env.example`). On the server, set `CORS_ORIGIN` and `APP_URL` to your Render site URL so admin invite links and browser CORS match.
