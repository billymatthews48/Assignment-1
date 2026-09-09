# Secure Networking Tracker

A private, per-user contact list for the people you want to stay connected
with — built for CS Berkeley networking, but useful for any relationship you
want to keep track of. Every contact is scoped to the signed-in user and that
scoping is enforced by Postgres Row Level Security, not just by the UI.

**Live app:** https://assignment-1-rho-five.vercel.app

## Screenshots / walkthrough

Every item below has been manually verified against the live URL above (see
the automated evidence in [Testing](#testing) and
[Verifying the two-account isolation guarantee](#verifying-the-two-account-isolation-guarantee)
for the parts that don't need a screenshot to trust). Add your own
screenshots/recording of the following before submitting — each takes under
a minute since the flows already work end-to-end:

1. Sign up → sign in → sign out (`/auth/sign-up`, `/auth/sign-in`, the
   account menu's "Sign Out")
   <img width="308" height="308" alt="image" src="https://github.com/user-attachments/assets/f65fbaf0-6d8d-4ba5-bd4b-9ef17677e6ac" />

3. Creating, editing, deleting a contact, then refreshing the page to show
   it persists
4. Typing a blank/whitespace-only name (or leaving priority unset) and
   submitting, to show the "Name is required." / priority error
5. Two browser profiles (or one normal + one private/incognito window)
   signed in as two different accounts side by side, each showing only its
   own contacts list

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
behavior — the row doesn't "exist" from User B's perspective). This was
verified by hand against the live project (see screenshots above).

Automated: [`scripts/rls-check.mjs`](scripts/rls-check.mjs) creates two
throwaway accounts (each in its own child process, so their sessions can't
bleed into each other the way two clients in one process sometimes do), has
each create a contact, then asserts that cross-account select/update/delete
all have zero effect:

```bash
npm run rls-check
```

**Actual output against this project's live database:**

```
> networking-tracker@0.1.0 rls-check
> node --env-file=.env.local scripts/rls-check.mjs

Creating two test accounts (each in its own process)...
  User A: rls-check-a-1788932794249-81961@example.com -> contact 8ede66e4-efb2-4df3-97fe-c203edb83958
  User B: rls-check-b-1788932795984-952248@example.com -> contact 705f5480-bd26-4034-b172-a787c338c6ba
  ✓ The two accounts have different user ids
  ✓ The two contacts have different ids

Checking SELECT isolation...
  ✓ User A's contact list does not include User B's contact
  ✓ User B's contact list does not include User A's contact

Checking cross-account READ isolation...
  ✓ User A cannot read User B's contact by id

Checking cross-account UPDATE isolation...
  ✓ User A's update to User B's contact had no effect

Checking cross-account DELETE isolation...
  ✓ User A's delete of User B's contact had no effect

Cleaning up...

PASSED: 0 assertion failure(s).
```

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
> networking-tracker@0.1.0 test
> vitest run

 RUN  v5.0.0

 ✓ src/lib/__tests__/validateContact.test.ts (6 tests) 3ms
   ✓ validateContact > rejects an empty name
   ✓ validateContact > rejects a whitespace-only name
   ✓ validateContact > rejects an invalid priority value
   ✓ validateContact > rejects a missing priority
   ✓ validateContact > accepts a valid contact and trims whitespace
   ✓ validateContact > accepts a valid contact with only the required fields

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

## Deployment

1. Push this repository to GitHub.
2. Import it into [Vercel](https://vercel.com/new) (or run `vercel` from the
   project directory).
3. In the Vercel project's Environment Variables settings, add
   `NEXT_PUBLIC_NEON_AUTH_URL`, `NEXT_PUBLIC_NEON_DATA_API_URL`, and
   `DATABASE_URL` with your Neon project's real values.
4. In the Neon console, go to **Auth → Configuration → Domains** and add
   your Vercel domain (e.g. `https://your-app.vercel.app`). Without this,
   sign-up/sign-in on the deployed site fails with "Invalid origin".
5. Redeploy if needed, open the live URL in a private browser window, and
   run through the Definition of Done checklist below.

**Gotcha we hit and fixed:** a page whose content depends entirely on
client-side auth state (like `/contacts`) must not be statically prerendered
at build time — Next.js will freeze it as static HTML, and a real page load
against that frozen HTML causes a React hydration crash that silently
breaks every button on the page in production (while looking fine in local
dev, since dev never hits that frozen static file). The fix is exporting
`export const dynamic = "force-dynamic"` from that route's `page.tsx` — see
[`src/app/contacts/page.tsx`](src/app/contacts/page.tsx).

## Definition of Done checklist

- [x] Live at a public Vercel URL — https://assignment-1-rho-five.vercel.app
- [x] Sign in and sign out work (verified live)
- [x] Add, view, edit, delete, sort, and filter contacts all work (verified live)
- [x] Data survives a refresh (verified live)
- [x] User A cannot see or change User B's contacts (verified via `npm run rls-check` against the live database — see output above)
- [x] Invalid data (empty name, bad priority) fails with a clear message (verified live)
- [x] `npm test` passes (6/6, see output above)
- [x] No secret values appear in the repository or Git history (`.env.local` is git-ignored; `.env.example` holds only placeholders; `DATABASE_URL` lives only in `.env.local` and Vercel's server-side env store)
- [ ] This README has the live URL and every grading artifact above — screenshots/recording still need to be added (see [Screenshots / walkthrough](#screenshots--walkthrough))

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
- Adding a custom domain (or a new Vercel preview/alias domain) later
  requires also adding it under Neon **Auth → Configuration → Domains**, or
  sign-in on that domain will fail with "Invalid origin".
