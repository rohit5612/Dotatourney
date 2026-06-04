# Dota Tournament App — Summary

High-level overview of the public site, admin console, backend flows, and database. This is a product/operations summary, not a deep architecture guide.

---

## Stack & layout

| Layer | Location | Notes |
|-------|----------|--------|
| Frontend | `dota/` (React + Vite) | Path-based routing in `App.jsx` (no React Router). API base: `VITE_API_BASE_URL` or `/api`. |
| Backend | `server/` (Express + PostgreSQL) | Routes: `/api/public`, `/api/admin`, `/api/tournaments`. Migrations in `server/src/db/migrations/`. |
| Static assets | `dota/public/` | Team logos under `images/teams/`; catalog in `dota/src/constants/teamLogos.js`. |

**Published event rule:** Only one tournament can be `is_published` at a time. The public site reads that event via `GET /api/public/tournament` (polled every ~30s on the frontend; server cache ~5s).

---

## Overall design

The app splits into two shells:

1. **Public site** — Marketing and live tournament experience: landing, info, brackets/schedule, teams, registration, rules/legal. Shared chrome: `SiteNavbar`, `AppFooter`, cookie consent, dark theme on public pages.
2. **Admin console** (`/admin`) — Authenticated operations after login. Eight **tabs** (not separate URLs): Registrations → Teams → Setup → News → Honors → Bracket/Schedule → Standings → Users (superadmin).

**Visibility modes** (tournament setting):

- **Demo** — Bracket can be generated with placeholder team names (`Team 1`, …) without a full approved roster.
- **Tournament** — Real teams from an **approved roster snapshot**; players must link to paid + approved registrations.

**Data flow pattern:** Admin pages mostly receive tournament state and handlers from `App.jsx`, which calls `dota/src/lib/api.js`. Public pages load one aggregated payload from `GET /api/public/tournament`.

---

## User-facing pages

| Route | Page | What visitors see | Backend |
|-------|------|-------------------|---------|
| `/` | Landing | Hero video, prize pool, registration CTA, winners block (if honors configured), tournament status/countdown, league overview, core team, sponsors, journey section, Discord CTA | `GET /api/public/tournament` (poll) |
| `/tournament` | Tournament hub | Name, description, status, honors preview, stats (format, fee, prize pool, deadline), paginated announcements, prize breakdown, rulebook | Same |
| `/schedule` | Bracket & schedule | Tabs: **Bracket** (group standings + stage bracket diagrams) and **Schedule** (phases: Groups / Last chance & play-ins / Playoffs; live, upcoming, finished matches). URL hash `#bracket` / `#schedule` | Same |
| `/teams` | Teams | Grid of competing teams: logos, rosters, honor badges; empty state with register link if no teams | Same |
| `/register` | Registration | OTP email flow, player details, UPI/QR payment upload, terms; “closed” when `registrations_open` is false | `GET/POST /api/public/tournaments/{slug}/register/*` (slug hardcoded as `bpcl` in UI) |
| `/rules` | Rules | Static conduct sections, PDF rulebook download, Discord link | Tournament payload for rulebook URL only |
| `/privacy` | Privacy | Static policy copy | None |
| `/cookies` | Cookies | Static policy copy | None |

**Navigation (public):** Home, Tournament, Bracket & Schedule, Teams, Rules, Register (CTA), Admin icon → `/admin`.

Invalid paths redirect to `/`.

---

## Admin-facing pages

Access: `/admin` (session via Bearer token). Invite signup: `/admin/invite/:token`.

| Tab | Page | What admins do | Main backend calls |
|-----|------|----------------|-------------------|
| **Registrations** | Registration CRM | Filter/search registrations, edit payment/approval status, notes, display name, archive, sync to Google Sheets | `GET/PATCH .../registrations`, `POST .../google-sheets/sync-registrations` |
| **Teams** | Team & roster builder | Build working teams from approved registrations; captains; import from CRM; pick logos from catalog; save named roster snapshots; resave; approve roster; assign BLAST groups A/B | `POST .../teams`, roster CRUD, `POST .../rosters/:id/approve`, `PUT .../group-assignments` |
| **Setup** | Tournament config | Create/edit tournament: name, slug, format (`blast` primary), team count, series rules map, dates, prize pool/breakdown, entry fee, rulebook, Discord, payment QR/UPI, registration prefix, `registrations_open`, visibility, publish/unpublish, import/export JSON | `POST/PUT/DELETE /api/tournaments`, `POST .../publish`, `.../unpublish`, `GET/POST .../export`, `.../import` |
| **News** | Announcements | Edit list announcements and rotating **banner** announcements (landing/tournament) | `PUT /api/tournaments/:id` (`announcements`, `banner_announcements`) |
| **Honors** | Tournament honors | Podium places count, MVP, custom honor cards; preview uses live tournament/bracket state | `PUT /api/tournaments/:id` (`tournament_honors`); honors computed on public read |
| **Bracket** | Brackets + schedule (sub-tabs) | **Brackets:** generate bracket, enter results, demo vs tournament mode, refresh progression, apply series rules. **Schedule:** assign times/streams to matches, set live YouTube URL | `POST .../generate`, `POST .../matches/:id/result`, `PATCH .../matches/:id`, `POST .../bracket/refresh-progression`, `POST .../series-rules/apply`, `POST .../schedule`, `PUT` tournament for `liveYoutubeUrl` |
| **Standings** | Standings | Group tables and overall BLAST standings with status labels (advancing, last chance, play-in, etc.) | Loaded via `GET /api/tournaments/:id` (computed standings in response) |
| **Users** | Admin users (superadmin) | List admins, send invites, approve/reject/revoke | `/api/admin/users`, `invites`, `PATCH .../status` |

**Auth endpoints:** bootstrap first superadmin, login/logout, `GET /api/admin/me`, invite register.

---

## Core backend workflows

### 1. Tournament lifecycle

1. **Create** — `POST /api/tournaments` → `status: draft`, unpublished.
2. **Configure** — `PUT` metadata: format, `team_count`, `series_rules` (per-stage BO1/3/5 keys), dates, prizes, payment fields, visibility, honors placeholders, etc.
3. **Registrations** — Players use public OTP flow; admins mark **paid** + **approved** in CRM.
4. **Teams (working copy)** — `POST .../teams` replaces `teams`, `players`, `team_players` for the draft tournament row set.
5. **Roster snapshot** — `POST .../rosters` copies working state to a named snapshot; **approve** one snapshot (`POST .../rosters/:id/approve`) — enforces team count, captain, eligible registrations. Only one approved roster per tournament.
6. **Group assignment (BLAST)** — `PUT .../group-assignments` sets `group_key` A/B on approved roster teams (blocked once `bracket_active`).
7. **Generate bracket** — `POST .../generate` builds all `matches` from format generator (replaces existing matches). Sets `is_generated`; tournament mode requires approved roster + valid groups.
8. **Bracket active** — After generation, `bracket_active` prevents roster/group regen mistakes; mid-tournament roster tweaks use **adjustments** on the approved snapshot.
9. **Publish** — `POST .../publish` unpublishes any other event, sets `is_published`, stores `published_snapshot` JSONB. Public site goes live.
10. **Unpublish** — `POST .../unpublish` → status back toward `approved`.
11. **Delete** — Only **draft** and unpublished tournaments.

**Live edits without republish:** Announcements, banner announcements, description, and `tournament_honors` merge from DB on public read even though bracket/teams may be frozen in `published_snapshot`.

### 2. Rostering: save, resave, sync

| Action | Behavior |
|--------|----------|
| Save working teams | `POST .../teams` — full replace of working teams/players |
| Create snapshot | `POST .../rosters` — copy current working state |
| Resave snapshot | `PUT .../rosters/:id` with `replaceFromCurrent: true` |
| Approve | Locks snapshot for bracket generation |
| Sync approved from teams | `POST .../teams` with `syncApprovedRosterId` — push working changes into approved roster |
| Mid-tournament adjustment | `POST .../rosters/:id/adjustments` — remove/move/add on **approved** roster; history in `roster_snapshot_team_memberships` |

### 3. Logos & local image folder

- Logos are **URLs** on `teams.logo_url` / `roster_snapshot_teams.logo_url`, not uploaded via API.
- **Catalog:** `TEAM_LOGO_CATALOG` in `dota/src/constants/teamLogos.js` → paths like `/images/teams/arcaneorder.png`.
- **Files:** add PNGs to `dota/public/images/teams/` and register in the catalog.
- Admin **Choose logo** modal on Teams page picks from catalog.
- Server `teamLogoUrl` helper prefers static paths over inline `data:` URLs on public responses.
- Optional script: `server/scripts/migrate-inline-logos-to-static.js` for backfill.

### 4. Announcements & banners

- Stored as JSONB arrays on `tournaments`: `announcements` (list/news), `banner_announcements` (rotating hero banners).
- Updated via tournament `PUT` (News tab).
- Public landing/tournament pick one banner via client helper; tournament page shows paginated announcement list.

### 5. Match results & progression

- **Record result:** `POST .../matches/:matchId/result` — winner, scores; runs **progression engine** (win-token graph fills next-round team slots).
- **Edit match:** `PATCH .../matches/:matchId` — if winner changes on a tokenized match, re-progression runs.
- **Refresh progression:** `POST .../bracket/refresh-progression` — re-applies all winner propagation + BLAST group seeding into playoff placeholders (useful after bulk fixes or import).
- Linked **schedule_slots** mark finished when match completes.

### 6. Series rules mid-tournament

- Tournament stores `series_rules` map (stage keys → BO1/BO3/BO5).
- **Apply to bracket:** `POST .../series-rules/apply` updates `meta.seriesType` on **upcoming, unwon** matches that have a `meta.seriesRuleKey` — does not rewrite finished matches.
- Updating rules on Setup + apply lets admins change BO format for remaining matches without regenerating the whole bracket.

### 7. Scheduling

- `POST .../schedule` replaces all `schedule_slots`: `match_id`, `start_at`, `stream`, `stream_url`, `status`, `notes`.
- `live_youtube_url` on tournament for site-wide “live now” embed.
- Public schedule view groups matches by BLAST phase tabs.

### 8. Standings

- **Computed at read time** in `standingsEngine.js` (not stored in `standings_cache` table — that table exists from early schema but is unused).
- Returns `standings` and `groupedStandings` on tournament GET and public payload.
- **BLAST:** per-group round-robin tables from `blast-group-a` / `blast-group-b` matches; tiebreakers: mini-league among tied teams → head-to-head → Neustadtl score; row `status` labels (advancing, last_chance, play_in, etc.) depend on group size.
- For **n ≥ 11** (except special cases n=10, n=12), a **merged global** ranking can feed playoff placeholders; n=10 and n=12 use **group ranks only** for seeding labels (`Group A #1`, `BLC1`, `MID*`, etc.).

### 9. Honors (public winners block)

- Config: `tournament_honors` JSON on tournament (podium count, MVP slot, custom cards).
- **Computed** at public read from bracket results + registrations (`bracketHonorsEngine`) — e.g. group winners, playoff podium, MVP from admin selection metadata.
- Shown on landing (`WinnerTeamCard`) and tournament hub when data exists.

### 10. Registration (public)

1. `request-otp` → email code  
2. `verify-otp` → `public_code` (e.g. `BPC-001`)  
3. `complete` → payment screenshot  
4. Admin approves in CRM → eligible for team builder  

Requires published tournament with `registrations_open: true`.

### 11. Import / export

- **Export:** full tournament JSON (teams, matches, schedule, etc.).
- **Import:** restore into draft tournament — used for backup or cloning structure.

---

## BLAST format (primary implemented format)

Minimum **10 teams**. Structure is generated in `formatGenerator.js` and surfaced as stage tabs on public/admin bracket views.

### Phases (conceptual)

```
Group A (BO1 RR)  ─┐
                   ├──► Last Chance ──► Play-In ──► Playoffs (QF / SF / F)
Group B (BO1 RR)  ─┘
         │
         └── Standings drive placeholder names until groups complete
```

| Stage keys (examples) | Purpose |
|----------------------|---------|
| `blast-group-a`, `blast-group-b` | Round-robin groups; teams assigned via admin group assignment |
| Last chance (`blast-lc-*`) | Lower group finishers fight to stay alive |
| Play-in (`blast-pi-*`) | Middle band qualifies toward main playoff path |
| Playoffs (`blast-qf`, `blast-sf`, `blast-f`, etc.) | Single-elimination with win-token progression |

**Sizing (`getBlastPhaseSizes`):**

- **n = 10:** Group #1s reserved for semis; #2 in QFs vs Play-In winners; #3 + LC survivors in Play-In; #4–#5 start Last Chance.
- **n = 12:** #1 wait in semis; #3/#4 middle knockout crossover; #2 vs LC finalist; #5/#6 start LC.
- **n ≥ 11 (general):** Merged standings tier — top seeds, middle knockout band, bottom → LC; LC survivors feed play-in/main path.

**Seeding after groups:** When group stages complete, `blastSeeding.js` replaces placeholders (`Group A #1`, `BLR1`, `MID1`, `BLC1`, …) with real team names on playoff matches. Triggered on result entry, refresh-progression, and tournament GET (persist if ready).

**Win tokens:** Matches carry `meta.winToken` (e.g. `LCR1M1W`, `QFR1M1W`); progression engine wires winners into `team1`/`team2` of downstream matches.

**Admin operations unique to BLAST:**

- Assign teams to Group A/B before generate (when `team_count` split matters).
- Watch **Standings** tab for per-group and merged tables.
- Use **Refresh progression** after fixing group results or imports so playoffs populate correctly.
- Use **Apply series rules** to change BO format on remaining knockout matches.

Other formats exist in code (`dse`, `se`, `gsl`, `rr`, `swiss`, `hybrid`) but BLAST is the fully featured path for this product.

---

## API surface (grouped)

| Domain | Base | Auth |
|--------|------|------|
| Public tournament + registration | `/api/public` | None |
| Admin auth & users | `/api/admin` | Session / superadmin |
| Tournament operations | `/api/tournaments` | Admin required |

Mutating tournament routes invalidate the public response cache so the site updates on next poll.

Key service modules: `tournamentRepository`, `registrationRepository`, `formatGenerator`, `progressionEngine`, `standingsEngine`, `blastStandings`, `blastSeeding`, `seriesRulesEngine`, `groupAssignment`, `bracketHonorsEngine`, `googleSheetsSync`, `emailService`.

---

## Database schema (overview)

PostgreSQL, 25 migration files (`001_init.sql` … `024_tournament_honors.sql`). Applied in filename order by `server/src/db/migrate.js`.

### `tournaments` (central)

Identity & config: `id`, `name`, `slug`, `format`, `series_type`, `series_rules` (JSONB), `team_count`, `status` (`draft` | `approved` | `published` | `archived`), `visibility_mode`, `bracket_active`, `is_generated`, `is_published`, `published_at`, `published_by`, `published_snapshot` (JSONB).

Content & ops: `description`, `prize_pool`, `prize_pool_breakdown`, `entry_fee`, `start_date`, `end_date`, `registration_deadline`, `discord_url`, `rulebook`, `live_youtube_url`, `announcements`, `banner_announcements`, `tournament_honors`, `dark_mode`.

Registration: `registration_code_prefix`, `registration_code_seq`, `payment_qr_image`, `payment_upi_id`, `registrations_open`.

### Working tournament graph

| Table | Role |
|-------|------|
| `teams` | `name`, `captain`, `abbr`, `seed`, `logo_url`, `accent_color` |
| `players` | Profile fields, `registration_id`, `roles`, `is_captain`, `display_name` |
| `team_players` | Many-to-many team ↔ player |
| `matches` | `stage_key`, `round_index`, `match_index`, `team1`, `team2`, `winner`, `status`, `meta` (winToken, seriesRuleKey, seriesType), scores |
| `schedule_slots` | `match_id`, `start_at`, `stream`, `stream_url`, `status`, `notes` |

**Legacy / unused:** `stages`, `match_results`, `standings_cache` (defined early, not used by app logic).

### Roster snapshots

| Table | Role |
|-------|------|
| `roster_snapshots` | Named copy; `status` draft/approved; one approved per tournament (unique partial index) |
| `roster_snapshot_teams` | Includes `source_team_id`, `logo_url`, `group_key` (A/B) |
| `roster_snapshot_players` | Includes `registration_id` |
| `roster_snapshot_team_players` | Baseline assignments at snapshot time |
| `roster_snapshot_team_memberships` | Active/inactive history for mid-tournament adjustments |

### Registrations

**`player_registrations`** — `email`, `name`, `display_name`, roles/MMR/Steam/Discord, `payment_screenshot`, `payment_status`, `registration_status`, `public_code`, OTP fields, `registration_flow_stage`, `draft_payload`, archive columns, `admin_notes`. Unique active email and `public_code` per tournament.

### Admin platform

| Table | Role |
|-------|------|
| `admin_users` | `email`, `password_hash`, `role`, `status` (pending/approved/revoked/…) |
| `admin_invites` | Token-based invite flow |
| `admin_sessions` | Bearer token hashes |

### Relationships (simplified)

```
tournaments ─┬─ teams ─── team_players ─── players ──?── player_registrations
             ├─ matches ─── schedule_slots
             ├─ roster_snapshots ─── roster_snapshot_teams / players / memberships
             └─ player_registrations

admin_users ─── admin_sessions
            └── admin_invites
```

---

## Typical operator sequence (BLAST event)

1. Create tournament in **Setup** (format `blast`, team count, series rules, payment/registration settings).
2. Open **Registrations** → approve paid players.
3. **Teams** → build rosters from registrations, logos, save snapshot → **approve** roster → assign **Group A/B**.
4. **Bracket** → generate matches (tournament visibility) → build **Schedule** → set live YouTube if needed.
5. **Publish** when ready for public site.
6. Run event: enter results in **Bracket**, monitor **Standings**, post **News**, configure **Honors**.
7. Mid-event: **Apply series rules**, **Refresh progression** if needed, roster **adjustments** for approved changes, edit announcements without republish.
8. Honors appear on landing/tournament as bracket completes.

---

## File references

| Area | Path |
|------|------|
| Public routes & pages | `dota/src/pages/PublicPages.jsx`, `dota/src/App.jsx` |
| Admin pages | `dota/src/pages/*.jsx` |
| API client | `dota/src/lib/api.js` |
| Team logos | `dota/src/constants/teamLogos.js`, `dota/public/images/teams/` |
| Backend routes | `server/src/routes/public.js`, `admin.js`, `tournaments.js` |
| Bracket/standings logic | `server/src/services/formatGenerator.js`, `progressionEngine.js`, `standingsEngine.js`, `blastSeeding.js` |
| Migrations | `server/src/db/migrations/` |
