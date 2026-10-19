# Staff Check-in · ลงเวลาพนักงาน

A phone web app for checking staff in and out of project sites by QR code.

- **Staff** log in once on their phone. They scan the QR code posted at a project, write what they are working on, and scan again when they leave to add what they did. They can see their own history with hours per day and per week.
- **Managers** see who is on site right now, a weekly timetable per staff member (one coloured block per project visit), hours per project and person, and visits that were closed automatically. They can fix times, export to Excel or CSV, print QR codes for projects, and invite staff.

Everything runs in Thai or English (switch at the top of every screen). All times are Bangkok time.

Design: [`docs/superpowers/specs/2026-10-19-staff-checkin-design.md`](docs/superpowers/specs/2026-10-19-staff-checkin-design.md)

## How it works

| Piece | What it does |
| --- | --- |
| `supabase/migrations/` | Tables (`profiles`, `projects`, `visits`), row-level security, and the functions every check-in goes through: `scan_in`, `scan_out`, `update_visit`, plus `auto_close_open_visits`, which runs every night at 23:59 Bangkok time |
| `supabase/functions/invite/` | Edge Function that lets a manager invite staff by email |
| `web/` | React app (Vite + TypeScript) used in the phone browser |

Rules worth knowing:

- Check-in and check-out times come from the server clock, never from the phone.
- A person can have only one open visit. Scanning in at another project closes the previous visit and flags it as *auto-closed*.
- Visits still open at 23:59 are closed and flagged too. Managers fix flagged visits under **Needs review**.
- GPS is saved with every scan when the phone allows it, but a scan is never blocked by location.
- Staff can only ever read their own visits. The database enforces this, not just the app.

## Run it locally

Needs Node 20+, Docker, and the [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`).

```bash
npx supabase start            # prints the local API URL and anon key
npx supabase db reset         # applies migrations + seed (two sample projects)
cd web
cp .env.example .env          # paste the anon key from `supabase start`
npm install
npm run dev                   # http://localhost:5173
```

Create your first user in Supabase Studio (http://127.0.0.1:54323 → Authentication → Add user), then make them a manager in the SQL editor:

```sql
update public.profiles set role = 'manager'
where id = (select id from auth.users where email = 'you@example.com');
```

Invitation emails sent locally appear in Mailpit at http://127.0.0.1:54324. To test invites locally, also run `npx supabase functions serve`.

## Tests

```bash
npx supabase test db          # database tests (pgTAP), needs `supabase start`
./scripts/test-db.sh          # same tests on a plain local Postgres 16 + pgTAP + pg_cron, no Docker
cd web && npx vitest run      # unit and component tests
cd web && npx playwright test # browser test of the whole flow against a fake backend
deno test supabase/functions/invite/validate.test.ts
```

## Put it online

1. **Supabase.** Create a project at https://supabase.com, choosing the **Southeast Asia (Singapore)** region. Then, from this folder:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push                      # creates the tables, rules and nightly job
   npx supabase functions deploy invite
   npx supabase secrets set APP_URL=https://<your-site>
   ```
   In the dashboard, under **Authentication → URL Configuration**, set **Site URL** to `https://<your-site>` and add `https://<your-site>/set-password` to the redirect URLs.
   Under **Database → Extensions**, `pg_cron` must be enabled. `db push` enables it, but check it if the nightly auto-close does not run.
2. **Web app.** Deploy the `web` folder to Netlify or Vercel (both free):
   - Build command `npm run build`, output folder `dist`, base directory `web`.
   - Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API), and `VITE_APP_URL` (your site address, e.g. `https://checkin.example.com`). This address is printed on the QR codes, so set it before printing.
   - `web/public/_redirects` (Netlify) and `web/vercel.json` (Vercel) already make links like `/scan/abc123` work.
3. **First manager.** In Supabase → Authentication → **Add user**, create your own account, then run the `update public.profiles set role = 'manager' …` SQL above. Log in to the app, open **Manager → People**, and invite everyone else. They get an email to set their password.
4. **QR codes.** Open **Manager → Projects**, add each site, then use **Print QR code** and stick the A4 sheet up at the site.
