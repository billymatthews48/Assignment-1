# Secure Networking Tracker

A private, per-user contact list for the people you want to stay connected
with — built for CS Berkeley networking, but useful for any relationship you
want to keep track of. Every contact is scoped to the signed-in user and that
scoping is enforced by Postgres Row Level Security, not just by the UI.

**Live app:** _TODO — paste the deployed Vercel URL here after deployment
(e.g. `https://networking-tracker-yourname.vercel.app`)._

## Screenshots / walkthrough

_TODO — add screenshots or a short screen recording covering:_
1. _Sign up → sign in → sign out_
2. _Creating, editing, deleting, and refreshing a contact_
3. _An invalid input (empty name or bad priority) failing with a clear error_
4. _Two accounts side by side, each seeing only their own contacts_

## Features

- Email/password sign-up, sign-in, and sign-out via Neon Managed Better Auth
- Add, view, edit, delete, sort, and filter contacts
- Contact fields: name, company, role, where you met, notes, priority
  (`high` / `medium` / `low`)
- Client-side search (name/company/role/notes) and priority filter, plus
  click-to-sort columns (name, company, priority, met at, added date)
- Distinct loading, empty, success, and error states
- Responsive layout: card list on mobile, table on tablet/desktop
- Data survives a refresh — it's stored in Neon Postgres, not local state
- Empty names and invalid priorities are rejected with a clear message,
  both in the UI (Zod) and, non-bypassably, in the database (CHECK constraints)
- Per-user data isolation enforced by Postgres Row Level Security

## Technology stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router, TypeScript) | Modern React framework, file-based routing, works cleanly with Vercel out of the box |
| Styling | Tailwind CSS v4 | Utility-first design system — fast to build a consistent, responsive UI without hand-rolling CSS |
| Auth + data access | `@neondatabase/neon-js` + `@neondatabase/auth-ui` | One SDK that wires Neon Managed Better Auth and the Neon Data API together, with prebuilt, accessible auth screens |
| Database & auth backend | Neon Postgres + Managed Better Auth + Data API | Managed Postgres with a hosted PostgREST-style API and JWT-based auth built in — no need to hand-roll a CRUD server |
| Validation | Zod | Small, typed schema that mirrors the database's own CHECK constraints, and is trivially unit-testable |
| Tests | Vitest | Fast, zero-config unit testing for the validation logic |
| Hosting | Vercel | Zero-config Next.js deploys, environment variable management, custom domains |

## Architecture

```
┌─────────────────────┐        HTTPS (JWT on every request)       ┌───────────────────────────────┐
│   Next.js frontend   │ ────────────────────────────────────────▶│        Neon (hosted)           │
│  (Vercel, client-    │                                            │  ┌───────────────────────────┐ │
│   rendered app)      │◀──────────────────────────────────────── │  │ Managed Better Auth        │ │
│                       │        contacts JSON / auth session       │  │ (sign up/in/out, JWTs)     │ │
│  @neondatabase/neon-js│                                            │  └───────────────────────────┘ │
└─────────────────────┘                                            │  ┌───────────────────────────┐ │
                                                                     │  │ Data API (PostgREST-style)│ │
                                                                     │  │ validates JWT, forwards    │ │
                                                                     │  │ auth.user_id() to Postgres │ │
                                                                     │  └─────────────┬─────────────┘ │
                                                                     │                ▼                │
                                                                     │  ┌───────────────────────────┐ │
                                                                     │  │ Postgres: contacts table   │ │
                                                                     │  │ + CHECK constraints        │ │
                                                                     │  │ + Row Level Security       │ │
                                                                     │  └───────────────────────────┘ │
                                                                     └───────────────────────────────┘
```

**Frontend and backend are genuinely separate deployments.** The Next.js app
(Vercel) contains no custom CRUD server code — it never talks to Postgres
directly and never sees `DATABASE_URL`. It only calls Neon's two public,
HTTPS endpoints (the Auth URL and the Data API URL). The "backend" is Neon
itself: Managed Better Auth issues a JWT on sign-in, and the Data API
validates that JWT on every request and passes the caller's user id into
Postgres via the `auth.user_id()` SQL function. **Row Level Security is what
actually enforces ownership** — even if the frontend were compromised or a
request were forged, Postgres itself refuses to return or modify another
user's rows. See [`src/lib/neon.ts`](src/lib/neon.ts) for the client and
[`db/schema.sql`](db/schema.sql) for the policies.

Client-side validation (`src/lib/validateContact.ts`, backed by Zod) mirrors
the database constraints so the UI can show an instant, clear error message —
but it is a UX convenience, not the security boundary. The database CHECK
constraints and RLS policies are what a malicious or buggy client cannot
bypass.

## Local setup

Prerequisites: Node.js 20+, a Neon account.

1. **Clone and install**
   ```bash
   git clone <your-repo-url>
   cd networking-tracker
   npm install
   ```

2. **Create a Neon project**
   - Go to [neon.tech](https://neon.tech) and create a new project.
   - In the project, enable **Managed Better Auth** (Auth tab) and the
     **Data API** (Data API tab).
   - Copy the **Auth URL**, the **Data API URL**, and the **Postgres
     connection string** from the console.

3. **Apply the schema**
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```
   (or paste the contents of [`db/schema.sql`](db/schema.sql) into the Neon
   SQL editor). This creates the `contacts` table, enables Row Level
   Security, and creates the four ownership policies.

4. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `NEXT_PUBLIC_NEON_AUTH_URL`, `NEXT_PUBLIC_NEON_DATA_API_URL`, and
   `DATABASE_URL` with the values from step 2.

5. **Run the app**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000), sign up, and start
   adding contacts.

## Environment variables

See [`.env.example`](.env.example) for the full, placeholder-only list.

| Variable | Exposure | Used for |
|---|---|---|
| `NEXT_PUBLIC_NEON_AUTH_URL` | Public | Neon Managed Better Auth endpoint — the frontend talks to this directly over HTTPS |
| `NEXT_PUBLIC_NEON_DATA_API_URL` | Public | Neon Data API endpoint — the frontend's only path to the database, always RLS-scoped |
| `DATABASE_URL` | Server-only | Direct Postgres connection string, used only to run `db/schema.sql` and the optional `scripts/rls-check.mjs` verification script. **Never imported by the Next.js app itself.** |

`NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` are not used by this
implementation — they belong to Neon's separate server-side, cookie-based
Next.js auth integration. This project instead uses the client-side
`@neondatabase/neon-js` SDK talking directly to the public Auth/Data API
URLs, so those two variables aren't needed here (kept commented out in
`.env.example` for spec completeness).

**No secret ever reaches the browser bundle or Git history:** only the two
`NEXT_PUBLIC_*` URLs (which are meant to be public — they're protected by
JWT validation and RLS, not by secrecy) are read by client code.
`DATABASE_URL` lives only in `.env.local` (git-ignored) and in Vercel's
server-side environment variable store.

## Database schema

Table: `contacts` (see [`db/schema.sql`](db/schema.sql) for the full DDL)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `gen_random_uuid()` |
| `user_id` | `text` | **Not null**, defaults to `auth.user_id()`. Owning user. |
| `name` | `text` | Not null; `CHECK (btrim(name) <> '')` rejects blank/whitespace-only names |
| `company` | `text` | Optional |
| `role` | `text` | Optional |
| `met_at` | `text` | Optional — where/how you met this person |
| `notes` | `text` | Optional |
| `priority` | `text` | Not null; `CHECK (priority IN ('high','medium','low'))` |
| `created_at` | `timestamptz` | Defaults to `now()` |
| `updated_at` | `timestamptz` | Defaults to `now()`, refreshed by a trigger on every update |

## Authentication & Row Level Security

- **Ownership column:** `user_id` is `text not null default auth.user_id()`.
  A row can never be created without an owner, and the default means the
  client never has to (and cannot usefully try to) set it directly.
- **RLS enabled:** `alter table contacts enable row level security;`
- **Four separate policies**, one per operation, each scoped to
  `auth.user_id() = user_id`:
  - `contacts_select_own` — `for select using (auth.user_id() = user_id)`
  - `contacts_insert_own` — `for insert with check (auth.user_id() = user_id)`
  - `contacts_update_own` — `for update using (...) with check (...)` — the
    `with check` means a user cannot update a row so that it becomes owned
    by someone else, and `using` means they can't touch a row they don't
    already own in the first place.
  - `contacts_delete_own` — `for delete using (auth.user_id() = user_id)`
- **Request flow:** sign-in returns a JWT from Managed Better Auth → every
  Data API call attaches that JWT → the Data API validates it and makes the
  user id available to Postgres as `auth.user_id()` → RLS policies compare
  it against `user_id` on every row before returning or modifying anything.
  This happens on **every** request, regardless of what the client sends —
  there's no server-side code path that has to remember to "check
  ownership."

### Verifying the two-account isolation guarantee

Manually: sign up as User A, add a contact, sign out, sign up as User B —
User B's contact list is empty, and User B cannot fetch User A's contact by
ID (RLS returns zero rows rather than an error, which is the correct RLS
behavior — the row doesn't "exist" from User B's perspective).

Automated: [`scripts/rls-check.mjs`](scripts/rls-check.mjs) creates two
throwaway accounts, has each create a contact, then asserts that
select/update/delete across accounts have no effect:

```bash
node --env-file=.env.local scripts/rls-check.mjs
```

_TODO — paste the output of this command (or the manual two-account
walkthrough with screenshots) here once you've run it against your Neon
project._

## Testing

```bash
npm test
```

Runs [`src/lib/__tests__/validateContact.test.ts`](src/lib/__tests__/validateContact.test.ts)
against [`src/lib/validateContact.ts`](src/lib/validateContact.ts), the
validation module every create/edit form submission goes through before
writing to the database. It asserts:
- an empty name is rejected
- a whitespace-only name is rejected
- an invalid `priority` value is rejected
- a missing `priority` is rejected
- a fully valid contact is accepted, with fields trimmed

This is a pure unit test with no network or database dependency, so it runs
identically in CI or on a grader's machine. The Postgres CHECK constraints in
[`db/schema.sql`](db/schema.sql) are the non-bypassable version of the same
rules — this test proves the logic the app relies on before ever reaching
the database is correct.

**Sample passing output:**
```
_TODO — paste the output of `npm test` here._
```

## Deployment

1. Push this repository to GitHub.
2. Import it into [Vercel](https://vercel.com/new) (or run `vercel` from the
   project directory).
3. In the Vercel project's Environment Variables settings, add
   `NEXT_PUBLIC_NEON_AUTH_URL`, `NEXT_PUBLIC_NEON_DATA_API_URL`, and
   `DATABASE_URL` with your Neon project's real values.
4. In the Neon console, add your Vercel domain (e.g.
   `https://your-app.vercel.app`) to Managed Better Auth's trusted origins,
   so sign-in works from the deployed URL.
5. Redeploy, open the live URL in a private browser window, and run through
   the Definition of Done checklist below.

## Definition of Done checklist

- [ ] Live at a public Vercel URL
- [ ] Sign in and sign out work
- [ ] Add, view, edit, delete, sort, and filter contacts all work
- [ ] Data survives a refresh
- [ ] User A cannot see or change User B's contacts (manually and via `scripts/rls-check.mjs`)
- [ ] Invalid data (empty name, bad priority) fails with a clear message
- [ ] `npm test` passes
- [ ] No secret values appear in the repository or Git history
- [ ] This README has the live URL and every grading artifact above

## Known limitations & next steps

- Sorting and filtering happen client-side over the signed-in user's own
  rows. This is simple and fast at personal-contact-list scale, but would
  need to move server-side (Data API query params) for a much larger list.
- No pagination — all of a user's contacts load at once.
- No password reset email delivery is configured out of the box (Better
  Auth supports it, but it needs an email provider configured in the Neon
  console).
- No avatar/photo per contact.
- The `scripts/rls-check.mjs` script creates real (throwaway) accounts
  against your Neon project each time it runs; it doesn't yet delete the
  accounts themselves afterward (only the contacts), so run it sparingly
  against a project you don't mind accumulating a few test users in.
- Next step: add organization-style shared address books if multi-user
  collaboration is ever needed (explicitly out of scope for this
  assignment).
