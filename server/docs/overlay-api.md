# GSI Overlay Card API

Public endpoints for stream overlays and external GSI apps to consume player card manifests and match roster cards.

Base URL (production): `https://api.bpcleague.in/api/public`

Website embed base (production): `https://bpcleague.in`

## Authentication

All overlay endpoints are **public** (no auth). Rate-limit at the CDN/reverse-proxy in production.

## Endpoints

### Player card by BPC ID (JSON)

```
GET /api/public/cards/:bpcId
```

**BPC ID formats** (case-insensitive):

| Input | Normalized |
|-------|------------|
| `BPC-042` | `BPC-042` |
| `bpc-042` | `BPC-042` |
| `042` | `BPC-042` |

**Response `200`**

```json
{
  "card": {
    "tier": "player",
    "bpcId": "BPC-042",
    "displayName": "AddicTzZ",
    "slug": "addictzz",
    "seasonBadge": "S2 Emerald",
    "stats": { "mmr": 4500, "role": "Mid", "roles": ["Mid"] },
    "steamAvatar": "https://...",
    "customImage": null,
    "tagline": null,
    "frameTheme": "emerald",
    "assetStatus": null
  }
}
```

**Response `400`** — invalid BPC ID format.

**Response `404`** — unknown BPC ID.

---

### Player card by BPC ID (PNG stub)

```
GET /api/public/cards/:bpcId.png
```

Returns a **1×1 PNG placeholder** until server-side rendering (sharp) is added in a later phase.

Headers:

| Header | Description |
|--------|-------------|
| `Content-Type` | `image/png` |
| `X-Card-Tier` | Purchased tier (`default`, `player`, `gold`, `holo`) |
| `Cache-Control` | `public, max-age=60` |

---

### Embeddable card page (browser source / iframe)

```
GET /overlay/card/:bpcId
GET /overlay/card/:bpcId?size=sm|md|lg
```

Chrome-free page with transparent background. Renders the same tier components as the website using the BPC-ID JSON API above.

**Examples**

```
https://bpcleague.in/overlay/card/BPC-042
https://bpcleague.in/overlay/card/042?size=sm
```

Use as an OBS Browser Source or iframe inside the external WebSocket GSI overlay app.

---

### Player card manifest by slug (JSON)

```
GET /api/public/players/:slug/card
```

**Response `200`**

```json
{
  "card": {
    "tier": "player",
    "bpcId": "BPC-042",
    "displayName": "AddicTzZ",
    "slug": "addictzz",
    "seasonBadge": "S2 Emerald",
    "stats": { "mmr": 4500, "role": "Mid", "roles": ["Mid"] },
    "steamAvatar": "https://...",
    "customImage": null,
    "tagline": null,
    "frameTheme": "emerald",
    "assetStatus": null
  }
}
```

**Response `404`** — unknown slug.

---

### Player card PNG (stub)

```
GET /api/public/players/:slug/card.png
```

Returns a **1×1 PNG placeholder** until server-side rendering (sharp) is added in a later phase.

Headers:

| Header | Description |
|--------|-------------|
| `Content-Type` | `image/png` |
| `X-Card-Tier` | Purchased tier (`default`, `player`, `gold`, `holo`) |
| `Cache-Control` | `public, max-age=60` |

Overlay apps should prefer the JSON manifest for layout and treat PNG as optional.

---

### Match roster cards

```
GET /api/public/matches/:id/roster-cards
```

**Response `200`**

```json
{
  "match": {
    "id": "uuid",
    "team1": "Team Alpha",
    "team2": "Team Beta",
    "stageKey": "upper",
    "status": "upcoming"
  },
  "team1": {
    "name": "Team Alpha",
    "cards": [ { "tier": "player", "bpcId": "BPC-001", "...": "..." } ]
  },
  "team2": {
    "name": "Team Beta",
    "cards": []
  }
}
```

Players without a linked `player_account_id` on the approved roster snapshot are omitted.

---

### Full public profile

```
GET /api/public/players/:slug
```

Includes card manifest, current team, season history, registrations, clips, and achievements.

## Webhook (payments — not overlay)

Cashfree payment webhooks use a separate route:

```
POST /api/webhooks/cashfree
```

Requires raw body + `x-webhook-signature` + `x-webhook-timestamp` (verified with Client Secret).

## Integration notes

1. Poll match roster cards when a match id is known (draft / break segments).
2. Use **BPC ID** (`bpcId` on each card manifest) as the stable key for overlay player slots.
3. Embed cards via `/overlay/card/:bpcId` or fetch JSON from `/api/public/cards/:bpcId`.
4. Cache JSON manifests for 30–60s; PNG stub is safe to cache briefly.
5. Use `frameTheme` + `tier` to pick overlay frame assets client-side.
6. Coordinate with the external WebSocket GSI app — this API is read-only HTTP.

## Environment

No special env vars for overlay consumers. Card data depends on:

- Approved roster snapshots with `player_account_id` on snapshot players
- Completed checkout registrations (`card_tier` on `player_registrations`)
