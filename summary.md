# BPC League — Platform Summary

**Bharat Pro Circuit League (BPC League)** is a full-stack web platform for running professional Dota 2 tournaments in India. It serves three audiences at once: fans browsing schedules and brackets, players registering and managing their competitive identity, and staff operating the league from a permissioned admin console.

Live site: [bpcleague.in](https://bpcleague.in)

---

## What the product does (plain language)

Think of it as **ESPN + Ticketmaster + a trading-card layer** for one esports league. Fans follow teams, brackets, and news. Players create an account, sign up for a season, pay an entry fee, and optionally buy a collectible digital player card. When the roster fills up, extra players join a **substitute pool** and can be called in on match day. Organizers run everything—approvals, brackets, results, honors, and commerce—from a single admin panel.

---

## Client-facing website

### Public pages

| Area | Purpose |
|------|---------|
| **Landing & tournament hub** | Season overview, prize pool, countdown, live stream links, and quick navigation into the active tournament. |
| **Bracket & schedule** | Interactive bracket views (groups, playoffs, upper/lower brackets) plus a match schedule with status, scores, and stream links. |
| **Teams** | Roster cards with logos, roles, and player lineups for approved teams. |
| **Seasons** | Archive of past seasons—champions, honors, and historical context. |
| **News & announcements** | League updates and banner announcements on the homepage. |
| **Community** | Discord and social entry points. |
| **Rules & legal** | Rulebook PDF, player conduct, privacy, cookies, terms, refund/cancellation policies. |
| **Match pages** | Per-match detail: teams, scores, lineups (including match-day subs), and series info. |
| **Public player profiles** | Shareable `/player/:slug` pages showing display name, stats, and the player’s card tier. |

The public site is SEO-aware (route meta, canonical URLs) and caches tournament payloads for fast repeat loads.

### Player accounts & dashboard

Players authenticate via **email/password** (with verification) or **Google OAuth**. After signup they link **Steam** and **Discord** to become registration-eligible—a simple “3 of 3 linked” checklist on the dashboard.

Each player receives a persistent **BPC ID** (e.g. `BPC-042`) and a URL slug used across registrations, cards, and public profiles.

**Dashboard sections:**

- **Overview** — eligibility status, current team card, registration shortcuts, card upgrade prompts.
- **Tournaments** — active season registration, payment status, and substitute-pool access.
- **Settings** — profile, MMR, roles, avatars, linked accounts.
- **History** — past tournament appearances and substitute games played.
- **Notifications** — substitute requests, approvals, and league messages.
- **Wallet** — **BPC Coin** balance (loyalty credit applied at checkout).

Password reset, account claim (for migrated Season 1 players), and session handling are built in.

---

## Registration, payments & substitutes

### Main registration flow

1. Player completes profile linkage and opens registration for the active season.
2. Submits details (MMR, roles, Steam/Discord, phone, location).
3. Receives an **email OTP**; on verify, gets a public registration code (`BPC-001`, `BPC-002`, …).
4. Proceeds to **checkout**—entry fee plus optional card tier bundle.
5. Pays via **Cashfree** (UPI/cards); **BPC Coins** can offset part of the total.
6. Registration enters **pending review** until staff approve it in admin.

A configurable **registration cap** automatically closes main signup when the approved roster limit is hit.

### Substitute pool

When the cap is reached:

- Main registration **closes**.
- The **substitute pool opens** (free signup from the dashboard).
- Substitutes submit MMR, preferred roles, availability, and notes.
- On match day, registered players can **request a sub**; admins approve; approved subs appear in **match lineups** and notifications go to all parties.

This separates “competing for a main slot” from “available as backup”—a common pain point in amateur leagues, handled explicitly in the product.

---

## Card system & commerce

Registration is bundled with optional **collectible player cards** in four tiers: **default**, **player**, **gold**, and **holo**.

| Concept | Detail |
|---------|--------|
| **Bundled pricing** | Each tier has a registration + card price; higher tiers discount the bundle (e.g. holo tier bundles registration with a premium card). |
| **BPC Coins** | In-app currency; players earn or receive grants and apply coins at checkout via a slider. |
| **Holo cards** | Client-side canvas engine—tilt, shine, portrait crop/zoom—for a premium “physical card” feel in the browser. |
| **Card assets** | Admins configure commerce per tournament, approve custom uploads, and set season badges/frames. |
| **Stream overlays** | Public JSON **card manifest API** feeds GSI overlays and broadcast tools with player name, tier, stats, and avatar—no auth required. |

Cards tie into **seasonal identity** (e.g. Season 2 “Emerald” theme): each season can ship its own palette, frame, and badge while player accounts persist across seasons.

---

## Brackets, standings & honors

The platform is not a static bracket image—it runs a **tournament engine** on the server.

**Supported formats** (via presets and templates):

- **BLAST-style** — groups → play-in / last chance → playoffs (12-team and 10-team presets).
- **Single / double elimination**
- **Round robin**

A **progression engine** advances winners through bracket slots using win/loss tokens, supports multi-stage BLAST flows, and keeps match ordering consistent across UI and API.

**Standings** derive from group and playoff results. **Honors** include podium placements, MVP, and custom award cards—editable in admin and rendered on the public tournament page (podium showcase, winner blocks).

Admins generate brackets from an approved roster snapshot, enter scores, and publish updates; the public site reflects changes after cache invalidation.

---

## Admin panel

Route: `/admin` — session-based auth with **role-based access control (RBAC)**. Superadmins manage users; other staff get granular **read/create/update/delete** permissions per section.

| Module | What staff do here |
|--------|-------------------|
| **Setup** | Create/edit tournaments: format, dates, prize pool, entry fee, registration cap, rulebook, visibility (demo vs published), payment QR/UPI fallback, engine template. |
| **Player CRM** | Search player accounts; review registrations; approve/reject/archive; manage substitute pool entries. |
| **Teams** | Build team pool, assign players to rosters, approve final roster snapshot used for brackets. |
| **Cards & commerce** | Tier pricing, coin rules, card asset approval workflow. |
| **News** | Announcements and homepage banner copy. |
| **Honors** | MVP, podium count, custom award cards. |
| **Seasons** | Season content, org roster, season card backgrounds/badges for archives. |
| **Bracket / schedule** | Generate bracket, record match results, edit schedule times and stream URLs. |
| **Standings** | Review computed standings. |
| **Users** | Invite admins, permission matrix, audit trail. |

Sensitive actions write to an **audit log**. View-only roles are supported per section.

---

## Tech stack

```
┌─────────────────────────────────────────────────────────┐
│  Netlify — React SPA (Vite build)                       │
│  bpcleague.in                                           │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS /api
┌────────────────────────▼────────────────────────────────┐
│  Hostinger VPS — Node.js + Express                      │
│  api.bpcleague.in                                       │
│  ├── PostgreSQL (tournaments, accounts, registrations)  │
│  ├── Redis / Upstash (public response cache)            │
│  ├── Nodemailer (OTP, invites, notifications)           │
│  └── Cashfree webhooks (payments)                       │
└─────────────────────────────────────────────────────────┘
```

| Layer | Choices |
|-------|---------|
| **Frontend** | React 19, React Router 7, Vite 8, Tailwind CSS 4, lazy-loaded routes, DOMPurify for rich HTML |
| **Backend** | Express 4, `pg` (PostgreSQL), Zod request validation, modular services + SQL migrations |
| **Auth** | Admin sessions (token header); player sessions + Google/Discord/Steam OAuth |
| **Payments** | Cashfree gateway + optional manual UPI/screenshot flow for legacy paths |
| **Email** | SMTP via Nodemailer; dev mode can skip send and return OTP in API |
| **Testing** | Node built-in test runner on core engines (progression, series rules, bracket generation) |

**Repo layout:** `dota/` (frontend), `server/` (API), `docs/` (deploy and feature notes).

---

## Architecture & product strategy

**Separation of concerns**

- **Public read API** — cached tournament snapshots for fans; invalidated when admins publish.
- **Player API** — authenticated registration, checkout, wallet, substitutes.
- **Admin API** — mutating operations behind RBAC and audit logging.

**Tournament engine**

- Format **presets** and reusable **engine templates** let staff spin up BLAST or classic brackets without bespoke code per event.
- **Roster snapshots** freeze approved teams/players before bracket generation—so late registration changes do not corrupt live brackets.

**Ecosystem evolution (Season 2 direction)**

Season 1 proved tournaments, brackets, and admin CRM. Season 2 pushes toward a **persistent competitive ecosystem**: same player account every season, collectible cards, public reputation (history, sub appearances), and seasonal theming—without rebuilding the core tournament stack.

**Operational choices**

- Frontend on **Netlify** (CDN, easy SPA deploy); API on a **VPS** (OAuth callbacks, webhooks, DB locality).
- **Progressive enhancement**: public pages work without login; registration and dashboard are authenticated flows.
- **Overlay-friendly APIs** for broadcast production—card manifests and match rosters as JSON for GSI tools.

---

## One-line pitch for a hiring manager

*Full-stack esports league platform: React SPA + Express/Postgres API powering public brackets and registration, player accounts with OAuth and payments, a collectible card commerce layer, substitute-pool workflows, and a permissioned admin console with a configurable tournament bracket engine—deployed split across Netlify and a VPS for bpcleague.in.*
