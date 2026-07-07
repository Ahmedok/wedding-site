# Project: Personalized Wedding Invitation & RSVP Site

Build a small full-stack web app: a wedding invitation website with a personalized RSVP form per invite, plus a lightweight admin view for the couple. Optimize for correctness and simplicity over cleverness — this needs to work reliably for non-technical guests on their phones, for a one-time event.

## Tech stack (fixed — do not substitute)

- **Frontend:** Astro (static site, minimal client-side JS) with plain CSS. Mobile-first, fast-loading.
- **Backend:** small API service — Node.js + Express (preferred) or FastAPI, your choice, but keep it minimal and dependency-light.
- **Database:** SQLite. No need for Postgres/MySQL at this scale.
- **Hosting model:**
  - Frontend deploys as a static build to Cloudflare Pages (or Netlify — note both as options in the README).
  - Backend runs on a home server and is exposed only via **Cloudflare Tunnel** (`cloudflared`) — never assume direct port-forwarding. Write the `docker-compose.yml` and a short setup note for this, but do not attempt to configure actual Cloudflare account credentials.
- Provide a `docker-compose.yml` that runs the backend + SQLite volume, ready to sit behind a tunnel.

## Data model

```sql
CREATE TABLE invites (
  id INTEGER PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,        -- short random slug, e.g. nanoid(8), used in the RSVP URL
  household_label TEXT NOT NULL,     -- e.g. "Jane & Tom"
  contact_email TEXT,
  contact_phone TEXT,
  message TEXT,                      -- optional note left by the household
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invited_guests (
  id INTEGER PRIMARY KEY,
  invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  is_placeholder BOOLEAN DEFAULT FALSE,  -- true for "plus-one" slots with no name yet
  attending BOOLEAN,                      -- NULL = not yet answered
  dietary_restrictions TEXT
);
```

## Functional requirements

### 1. Public RSVP page — `/rsvp/[token]`
- Look up the invite by token. If not found, show a friendly "we couldn't find your invite — please text/email [placeholder contact]" message. Never leak whether a token almost-matched something.
- Greet the household by `household_label`.
- Render one card per row in `invited_guests` for that invite:
  - Name: read-only if `is_placeholder = false`; editable text input if `is_placeholder = true` (lets a named plus-one fill in their own name).
  - Attending: Yes/No toggle.
  - Dietary restrictions: text field, only shown/required when attending = Yes.
- One shared block for the household: contact email, contact phone, optional message to the couple.
- If the invite already has answers saved, **pre-fill the form with existing data** on load (this page must be revisitable and editable, not one-shot).
- Submit does an upsert (create or update) keyed by `token`, and updates `updated_at`.
- Show a clear confirmation state after submit, and let the person come back to the same link to change their answer later.
- Display the RSVP deadline date prominently (make it a config value, not hardcoded in multiple places).

### 2. Marketing/info pages (static content, no backend needed)
- Home / our story
- Event details: ceremony + reception venue, time, dress code
- Travel & accommodation
- Photo gallery (placeholder images/config for now)
- Link to the RSVP page (the couple will send personalized links directly to guests, so this page doesn't need a generic RSVP entry point — but include one generic informational page that says "check your invite text/email for your personal RSVP link")

### 3. Admin
- A single admin page, protected by a simple shared password (env var, not OAuth — this is a two-person team) at `/admin`.
- Table view: household, each guest's name + attending status + dietary notes, contact info, last updated.
- Filter/sort by response status (responded / not yet responded / declined).
- CSV export endpoint for the full guest list (this is what goes to the caterer/venue).

### 4. Guest link generation (CLI script, run once/occasionally by the couple)
- Script (`scripts/generate-invites.ts` or `.py`) that takes a CSV input:
  ```
  household_label,guest_names (semicolon-separated),plus_one_slots
  "Jane & Tom","Jane Smith;Tom Smith",0
  "The Alvarez Family","Maria Alvarez;Carlos Alvarez;Sofia Alvarez",0
  "Priya Nair","Priya Nair",1
  ```
- For each row: create an `invites` row with a fresh short token (nanoid, 8 chars, URL-safe alphabet), create `invited_guests` rows for each named guest, and create additional placeholder rows for `plus_one_slots`.
- Output a CSV of `household_label, full_rsvp_url` for mail-merging into texts/emails/QR codes.
- Running the script twice on the same input should not duplicate existing households — key on `household_label` or an explicit external ID column, your call, just document the behavior.

### 5. Notifications (optional but nice — implement if time allows)
- On submit, send a confirmation email via a transactional email API (use Resend or Postmark; put the API key in an env var, and if none is configured, just skip sending rather than erroring).
- Also notify the couple's own email on every new/updated RSVP.

## Non-functional requirements
- Mobile-first responsive design — most guests will open this on a phone from a text message.
- No client-side framework bloat; keep JS minimal (Astro islands only where actually interactive, i.e. the RSVP form).
- Basic abuse protection on the RSVP submit endpoint: rate limit by IP, and a honeypot field (invisible to humans) to deter simple bots.
- Tokens must not be sequential or guessable — use a proper random generator, not incrementing IDs, in the URL.
- No user accounts, no login for guests — the token in the URL is the only auth, by design, for a low-stakes personal event.
- Environment variables (document all of these in `.env.example`): `DATABASE_PATH`, `ADMIN_PASSWORD`, `EMAIL_API_KEY` (optional), `COUPLE_NOTIFICATION_EMAIL` (optional), `RSVP_DEADLINE_DATE`.

## Explicitly out of scope
- Gift registry integration
- Multi-language support
- Payment processing
- User accounts / social login
- Anything involving guests being able to see or affect other guests' data

## Deliverables checklist
- [ ] Astro frontend with info pages + `/rsvp/[token]` page
- [ ] Backend API: `GET /api/invite/:token`, `POST /api/invite/:token/rsvp`, `GET /api/admin/invites` (password-protected), `GET /api/admin/export.csv`
- [ ] SQLite schema + migration script
- [ ] `scripts/generate-invites` CLI
- [ ] `docker-compose.yml` for the backend, sized for Cloudflare Tunnel deployment
- [ ] `.env.example`
- [ ] `README.md` covering: local dev setup, how to deploy frontend to Cloudflare Pages/Netlify, how to set up `cloudflared` for the backend, how to run the invite-generation script

Ask me for the actual wedding details (names, date, venue, colors/theme, deadline) before finalizing the info pages — use clearly marked placeholder content until then.
