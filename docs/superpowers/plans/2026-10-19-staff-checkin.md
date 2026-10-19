# Staff QR Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone web app where staff scan a project's QR code to check in and out with a task note, and managers get timetables, project summaries, a live on-site view and Excel/CSV export.

**Architecture:** Supabase holds all data and rules: Postgres tables with row-level security, `security definer` RPC functions for every visit write, a `pg_cron` end-of-day job, and one Edge Function for invites. A React + Vite SPA in `web/` talks to Supabase directly with the anon key, and the staff and manager areas are separate route trees.

**Tech Stack:** Supabase CLI 2.x (Postgres 15, pgTAP, pg_cron, Edge Functions/Deno), React 18, Vite, TypeScript, react-router 6, @supabase/supabase-js 2, i18next + react-i18next, html5-qrcode, @fullcalendar/react (timegrid), xlsx (SheetJS), qrcode, date-fns + date-fns-tz, Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-staff-checkin-design.md`

## Global Constraints

- Time zone `Asia/Bangkok` for every displayed time, every day boundary and the auto-close job. Store `timestamptz`.
- Visit timestamps come from the server (`now()`), never from the client.
- At most one open visit per user (partial unique index).
- Visits have no direct insert/update/delete grants. Writes go only through `scan_in`, `scan_out`, `update_visit` and `auto_close_open_visits`.
- Languages: `en` and `th`. Default `th`. Every user-facing string goes through i18next; there are no hard-coded UI strings. Thai dates use the `th-TH` locale (Buddhist-era years).
- `auto_closed` values: `null`, `'switched_project'`, `'end_of_day'`.
- Roles: `'staff'` (default), `'manager'`.
- QR link format: `${VITE_APP_URL}/scan/<project.code>`.
- GPS never blocks a scan. Geolocation timeout is 10 s.
- The service-role key is never shipped to the browser.
- Env vars for the web app: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`.

## Review Focus

1. **The same QR link is opened twice quickly (double tap, reload, slow network).** Expect exactly one open visit; the second call returns `already_in`. Test in Task 3 (`scan_in twice concurrently-safe`).
2. **The phone refuses location or never answers.** Expect the scan to complete with null GPS after ≤10 s. Test in Task 7 (`getPosition resolves null on error and on timeout`).
3. **A visit that crosses midnight in Bangkok after a manager edits it** (e.g. 22:00 → 01:30). Expect it to be counted on its check-in day in history and totals, and shown as one block spanning midnight in the timetable. Test in Task 6 (`groupVisitsByDay uses Bangkok check-in date`).
4. **Thai text in the CSV export opened in Excel.** Expect correct Thai characters (UTF-8 BOM). Test in Task 11 (`toCsv starts with BOM`).
5. **A manager edit sets check-out before check-in, or an archived project's QR is scanned, or a deactivated user scans.** Expect a clear translated error and no data change. Tests in Task 3.

---

## File Structure

```
supabase/
  config.toml                       (supabase init)
  migrations/
    20261019000001_schema.sql       tables, indexes, profile trigger
    20261019000002_rls.sql          RLS policies + grants
    20261019000003_scan_rpc.sql     scan_in, scan_out, update_visit
    20261019000004_auto_close.sql   auto_close_open_visits + cron schedule
  functions/invite/index.ts         manager-only invite Edge Function
  tests/
    helpers.sql                     test user creation helpers
    01_schema.test.sql
    02_rls.test.sql
    03_scan.test.sql
    04_auto_close.test.sql
web/
  package.json, vite.config.ts, tsconfig.json, index.html, .env.example
  src/
    main.tsx, App.tsx               router + role guard
    lib/supabase.ts                 client
    lib/auth.tsx                    AuthProvider, useAuth()
    lib/api.ts                      typed RPC/query wrappers
    lib/types.ts                    Visit, Project, Profile types
    lib/time.ts                     Bangkok time helpers (pure)
    lib/geo.ts                      getPosition()
    lib/export.ts                   buildExportRows, toCsv, toXlsx (pure)
    lib/summary.ts                  summarizeProject (pure)
    i18n/index.ts, en.json, th.json
    components/                     Layout, LanguageSwitch, VisitForm, ...
    pages/Login.tsx, SetPassword.tsx
    pages/staff/Home.tsx, Scan.tsx, History.tsx, Settings.tsx
    pages/manager/OnSite.tsx, Timetable.tsx, ProjectSummary.tsx,
                  Review.tsx, Export.tsx, Projects.tsx, ProjectQr.tsx, People.tsx
  tests/ (unit tests next to libs as *.test.ts; e2e/ for Playwright)
README.md                           setup + deploy
```

---

### Task 1: Supabase project and schema

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20261019000001_schema.sql`, `supabase/tests/helpers.sql`, `supabase/tests/01_schema.test.sql`

**Interfaces:**
- Produces: tables `profiles`, `projects`, `visits` with the columns in the spec's Data model; index `visits_one_open_per_user` on `visits(user_id) where check_out_at is null`; check `check_out_at is null or check_out_at > check_in_at`; trigger `on_auth_user_created` creating a profile (`full_name` from `raw_user_meta_data->>'full_name'`, else the email local part); helper `tests.create_user(email text, role text default 'staff') returns uuid` that inserts into `auth.users` and sets the role; helper `tests.login_as(uid uuid)` that sets `request.jwt.claims` and `role authenticated`.
- `projects.code` default: `substr(md5(random()::text), 1, 6)`. `projects.color` default `'#3b82f6'`.

- [ ] **Step 1:** `npx supabase init` at the repo root, then `npx supabase start` (needs Docker). Expected: local API URL and anon key printed.
- [ ] **Step 2: Write failing tests** in `01_schema.test.sql` (pgTAP, `plan(6)`):
  - `has_table('profiles')`, `has_table('projects')`, `has_table('visits')`
  - creating a user via `tests.create_user('a@x.th')` creates a `profiles` row with `role = 'staff'` and `language = 'th'`
  - inserting a second open visit for the same user `throws_ok` with SQLSTATE `23505`
  - inserting a visit with `check_out_at = check_in_at - interval '1 minute'` `throws_ok` with `23514`
- [ ] **Step 3:** `npx supabase test db`. Expected: FAIL (tables missing).
- [ ] **Step 4:** Write the schema migration and `helpers.sql` (loaded by every test file with `\i`), then run `npx supabase db reset`.
- [ ] **Step 5:** `npx supabase test db`. Expected: `01_schema.test.sql .. ok`.
- [ ] **Step 6: Commit** `feat(db): schema for profiles, projects, visits`.

### Task 2: Row-level security

**Files:**
- Create: `supabase/migrations/20261019000002_rls.sql`, `supabase/tests/02_rls.test.sql`

**Interfaces:**
- Produces: SQL function `public.is_manager() returns boolean` (stable, security definer, true when the caller's profile has `role = 'manager'` and `active`). Policies:
  - `profiles`: select own or `is_manager()`; update own row, but a `before update` trigger rejects changes to `role`/`active` unless `is_manager()` and the target is not the caller.
  - `projects`: select when `not archived or is_manager()`; insert/update only `is_manager()`.
  - `visits`: select when `user_id = auth.uid() or is_manager()`. Revoke insert/update/delete from `anon, authenticated`.

- [ ] **Step 1: Write failing tests** (`plan(7)`): as staff A, see only A's visits (count = 1 when A and B each have one); as staff A, `insert into visits` throws `42501`; as staff A, `update visits` affects 0 rows or throws; as staff A, updating own `role` to `manager` throws; as manager, see 2 visits; as staff, archived projects are not visible; as manager, archived projects are visible.
- [ ] **Step 2:** `npx supabase test db` → FAIL.
- [ ] **Step 3:** Write the migration, then `npx supabase db reset`.
- [ ] **Step 4:** `npx supabase test db` → all ok.
- [ ] **Step 5: Commit** `feat(db): row-level security`.

### Task 3: Scan RPC functions

**Files:**
- Create: `supabase/migrations/20261019000003_scan_rpc.sql`, `supabase/tests/03_scan.test.sql`

**Interfaces:**
- Produces (all `security definer`, `set search_path = public`, granted to `authenticated`):
  - `scan_in(p_project_code text, p_task text, p_lat float8, p_lng float8, p_accuracy float8) returns jsonb` → `{"status": "checked_in" | "already_in", "visit": <visit row as json>, "closed_visit_id": uuid|null}`
  - `scan_out(p_visit_id uuid, p_task text, p_work_done text, p_lat float8, p_lng float8, p_accuracy float8) returns jsonb` → the updated visit row
  - `update_visit(p_visit_id uuid, p_check_in_at timestamptz, p_check_out_at timestamptz, p_task text, p_work_done text) returns jsonb` → manager only; sets `edited_by = auth.uid()`, `edited_at = now()`
- Errors are raised with `raise exception using errcode = 'P0001', message = <code>`, where `<code>` is one of `inactive_user`, `unknown_project`, `archived_project`, `empty_task`, `visit_not_open`, `not_your_visit`, `not_manager`, `bad_times`. The frontend maps these codes to i18n keys `errors.<code>`.
- `scan_in` takes `pg_advisory_xact_lock(hashtext(auth.uid()::text))` before reading open visits, so concurrent calls for the same user serialize.

- [ ] **Step 1: Write failing tests** (`plan(13)`):
  - first `scan_in` → `status = 'checked_in'`, one open visit
  - same project again → `status = 'already_in'`, still one visit (Review Focus 1)
  - different project → the first visit has `check_out_at` set and `auto_closed = 'switched_project'`; the new one is open; `closed_visit_id` = first id
  - unknown code → throws `unknown_project`; archived project → `archived_project`; whitespace task → `empty_task`; inactive user → `inactive_user`
  - `scan_out` by owner → `check_out_at` set, `work_done` saved; again → `visit_not_open`; by another user → `not_your_visit`
  - `update_visit` by staff → `not_manager`; by manager with out < in → `bad_times`; valid manager edit sets `edited_by`
- [ ] **Step 2:** `npx supabase test db` → FAIL.
- [ ] **Step 3:** Implement the migration, then `npx supabase db reset`.
- [ ] **Step 4:** `npx supabase test db` → all ok.
- [ ] **Step 5: Commit** `feat(db): scan_in, scan_out, update_visit`.

### Task 4: End-of-day auto-close

**Files:**
- Create: `supabase/migrations/20261019000004_auto_close.sql`, `supabase/tests/04_auto_close.test.sql`

**Interfaces:**
- Produces: `auto_close_open_visits() returns integer` (count closed; not granted to `authenticated`); `create extension if not exists pg_cron`; `cron.schedule('auto-close-visits', '59 16 * * *', 'select public.auto_close_open_visits()')` (16:59 UTC = 23:59 Asia/Bangkok).

- [ ] **Step 1: Write failing tests** (`plan(4)`): with two open visits and one closed, the function returns 2; both now have `auto_closed = 'end_of_day'` and `check_out_at` not null; the closed one is unchanged; `select count(*) from cron.job where jobname = 'auto-close-visits'` = 1.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement + `db reset`. **Step 4:** Run → ok.
- [ ] **Step 5: Commit** `feat(db): end-of-day auto-close job`.

### Task 5: Invite Edge Function

**Files:**
- Create: `supabase/functions/invite/index.ts`, `supabase/functions/invite/index.test.ts`

**Interfaces:**
- Produces: `POST /functions/v1/invite` with body `{ email: string, full_name: string, role: 'staff'|'manager' }` and the caller's `Authorization: Bearer <jwt>`. Responses: `200 {user_id}`; `401` with no/invalid JWT; `403 {error:'not_manager'}`; `400 {error:'bad_request'}` when the email is invalid or the role is unknown. It uses `SUPABASE_SERVICE_ROLE_KEY` server-side for `auth.admin.inviteUserByEmail(email, { data: { full_name }, redirectTo: APP_URL + '/set-password' })`, then sets `profiles.role`.
- Export a pure `validateInvite(body: unknown): { email, full_name, role } | null` for unit testing.

- [ ] **Step 1: Write failing tests** for `validateInvite` (Deno test): valid body → object; missing email, bad email, role `'admin'` → null.
- [ ] **Step 2:** `deno test supabase/functions/invite` (or `npx supabase functions serve` + curl) → FAIL.
- [ ] **Step 3:** Implement. **Step 4:** Tests pass; with `functions serve`, curl using a staff JWT returns 403 and a manager JWT returns 200 (an invite email appears in Inbucket at `http://localhost:54324`).
- [ ] **Step 5: Commit** `feat: invite edge function`.

### Task 6: Web app shell, auth, i18n and time helpers

**Files:**
- Create: the `web/` Vite React TS scaffold, `web/.env.example`, `src/lib/supabase.ts`, `src/lib/auth.tsx`, `src/lib/types.ts`, `src/lib/time.ts`, `src/lib/time.test.ts`, `src/i18n/*`, `src/App.tsx`, `src/components/Layout.tsx`, `src/components/LanguageSwitch.tsx`, `src/pages/Login.tsx`, `src/pages/SetPassword.tsx`

**Interfaces:**
- `types.ts`: `Profile {id, full_name, role: 'staff'|'manager', language: 'en'|'th', active}`, `Project {id, code, name, address, lat, lng, color, archived}`, `Visit {id, user_id, project_id, check_in_at: string, check_out_at: string|null, task, work_done: string|null, in_lat…out_accuracy_m: number|null, auto_closed: null|'switched_project'|'end_of_day', edited_by, edited_at}`.
- `auth.tsx`: `<AuthProvider>`, `useAuth(): { session, profile: Profile|null, loading, signOut() }`.
- `time.ts` (pure, `TZ = 'Asia/Bangkok'`):
  - `bangkokDate(iso: string): string` → `'YYYY-MM-DD'`
  - `durationMinutes(v: Pick<Visit,'check_in_at'|'check_out_at'>, now?: Date): number` (open visits count up to `now`)
  - `formatDuration(min: number): string` → `'7h 05m'`
  - `formatTime(iso: string, lang: 'en'|'th'): string` → `'08:12'`
  - `formatDate(iso: string, lang): string` → en `'Mon 19 Oct 2026'`, th uses `th-TH` with Buddhist year (contains `'2569'`)
  - `groupVisitsByDay(visits: Visit[]): { date: string; visits: Visit[]; totalMinutes: number }[]`, newest day first
  - `weekRange(date: string): { start: string; end: string }` → Monday–Sunday in Bangkok
- Routes: `/login`, `/set-password`, `/` (staff Home), `/scan`, `/scan/:code`, `/history`, `/settings`, `/manager/*` (guarded: `profile.role === 'manager'`, else redirect `/`). Unauthenticated → `/login?next=<path>`, and after login navigate to `next` (so a QR scan survives login).
- i18n: `LanguageSwitch` toggles `en`/`th` and saves to `profiles.language`; the initial language comes from the profile, else `localStorage`, else `th`. Add a test that `en.json` and `th.json` have identical key sets.

- [ ] **Step 1: Write failing tests** in `time.test.ts`: `bangkokDate('2026-10-19T17:30:00Z') === '2026-10-20'`; `durationMinutes({check_in_at:'…T01:00:00Z', check_out_at:'…T08:05:00Z'}) === 425`; `formatDuration(425) === '7h 05m'`; `formatDate('2026-10-19T03:00:00Z','th')` contains `'2569'`; `groupVisitsByDay` puts a visit 22:00→01:30 Bangkok on its check-in date with 210 min (Review Focus 3); `weekRange('2026-10-21')` → `{start:'2026-10-19', end:'2026-10-25'}`; plus the i18n key-parity test.
- [ ] **Step 2:** `cd web && npx vitest run` → FAIL.
- [ ] **Step 3:** Scaffold (`npm create vite@latest web -- --template react-ts`), install deps, implement the libs, i18n, router, Login (email + password) and SetPassword (`supabase.auth.updateUser({password})`).
- [ ] **Step 4:** `npx vitest run` → PASS; `npm run build` → success; manually log in against local Supabase.
- [ ] **Step 5: Commit** `feat(web): app shell, auth, i18n, time helpers`.

### Task 7: Staff Home and Scan

**Files:**
- Create: `src/lib/geo.ts`, `src/lib/geo.test.ts`, `src/lib/api.ts`, `src/components/VisitForm.tsx`, `src/components/VisitForm.test.tsx`, `src/pages/staff/Home.tsx`, `src/pages/staff/Scan.tsx`

**Interfaces:**
- `geo.ts`: `getPosition(timeoutMs = 10000): Promise<{lat:number; lng:number; accuracy:number} | null>`; never rejects.
- `api.ts`: `getOpenVisit(): Promise<(Visit & {project: Project}) | null>`; `getProjectByCode(code): Promise<Project|null>`; `scanIn(code, task, pos)`; `scanOut(visitId, task, workDone, pos)`; `updateVisit(...)`; all throw `ApiError {code: string}` with the RPC error code from Task 3.
- `VisitForm` props: `{ mode: 'in'|'out'; project: Project; initialTask?: string; switchingFrom?: Project; onSubmit(task: string, workDone?: string): Promise<void> }`.
- Scan page: `/scan` shows the `html5-qrcode` camera; on decoding a URL whose path matches `/scan/:code`, navigate there. `/scan/:code` loads the project and the open visit and shows `VisitForm` in `out` mode if the open visit is at this project, else `in` mode (with `switchingFrom` if open elsewhere). On camera error, show `t('scan.cameraDenied')`.
- Home: big Scan button; when an open visit exists, the project name, "since HH:MM", live elapsed time (updates every minute) and a Check out button → `VisitForm` `out` mode.

- [ ] **Step 1: Write failing tests:** `getPosition` resolves `null` when `navigator.geolocation.getCurrentPosition` calls the error callback, and resolves `null` after the timeout when it never calls back (fake timers) (Review Focus 2); `VisitForm` in mode `in` disables submit while the task is blank; mode `out` pre-fills the task and submits `(task, workDone)`; `switchingFrom` renders the warning containing the other project's name.
- [ ] **Step 2:** `npx vitest run` → FAIL. **Step 3:** Implement. **Step 4:** Tests pass; manual check on local Supabase: check in, reload `/scan/<code>` (shows the check-out form), check out.
- [ ] **Step 5: Commit** `feat(web): staff scan and home`.

### Task 8: Staff History and Settings

**Files:**
- Create: `src/pages/staff/History.tsx`, `src/pages/staff/History.test.tsx`, `src/pages/staff/Settings.tsx`

**Interfaces:**
- Consumes `groupVisitsByDay`, `formatDuration`, `weekRange` (Task 6). `api.ts` gains `listMyVisits(from: string, to: string): Promise<(Visit & {project: Project})[]>`.
- History shows a week picker (prev/next), days with visits (project colour dot, name, times, task, duration, an auto-closed badge using `t('visit.autoClosed.<value>')`), a day total and a week total.
- Settings: name (editable), LanguageSwitch, log out.

- [ ] **Step 1:** Test: given two visits on different days (mocked api), it renders two day headings and a week total of `'9h 30m'`; an auto-closed visit shows the badge.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(web): staff history and settings`.

### Task 9: Manager On site now and Needs review

**Files:**
- Create: `src/pages/manager/OnSite.tsx`, `src/pages/manager/Review.tsx`, `src/components/VisitEditDialog.tsx`, `src/components/VisitEditDialog.test.tsx`

**Interfaces:**
- `api.ts` gains `listOpenVisits()`, `listUnreviewedAutoClosed()` (`auto_closed is not null and edited_at is null`), `subscribeVisits(onChange: () => void): () => void` (Supabase Realtime on `visits`; enable it with `alter publication supabase_realtime add table visits` in a new migration `20261019000005_realtime.sql`).
- `VisitEditDialog` props `{ visit: Visit & {project: Project; profile: Profile}; onSaved(): void }`: datetime inputs in Bangkok time, task and work done, a GPS link `https://maps.google.com/?q=lat,lng` for in and out when present. Save calls `updateVisit` and shows `t('errors.bad_times')` on that error.
- OnSite: open visits grouped by project, with name, since time and elapsed time; refetches on realtime change.
- Review: a list of unreviewed auto-closed visits, each opening `VisitEditDialog`.

- [ ] **Step 1:** Test `VisitEditDialog`: converts the Bangkok input `'2026-10-19T08:00'` to ISO `'2026-10-19T01:00:00.000Z'` in the `updateVisit` call; shows the bad_times message when the api throws `ApiError('bad_times')`.
- [ ] **Step 2–4:** Fail → implement → pass; manual: a second browser checking in appears on OnSite without a reload.
- [ ] **Step 5: Commit** `feat(web): manager on-site and review`.

### Task 10: Manager staff timetable

**Files:**
- Create: `src/pages/manager/Timetable.tsx`, `src/lib/calendar.ts`, `src/lib/calendar.test.ts`

**Interfaces:**
- `calendar.ts`: `toCalendarEvents(visits: (Visit & {project: Project})[], now?: Date): EventInput[]` → `{ id, title: project.name + ' · ' + task, start, end: check_out_at ?? now, backgroundColor: project.color, classNames: auto_closed && !edited_at ? ['flagged'] : [] }`.
- Timetable: staff selector (all active profiles) and a FullCalendar `timeGridWeek` with `timeZone: 'Asia/Bangkok'` (via the `@fullcalendar/luxon3` plugin or the named-timezone support FullCalendar provides), `slotMinTime '06:00'`, `slotMaxTime '22:00'` with a toggle for 00:00–24:00, `firstDay 1` and `locale` from i18n. Clicking an event opens `VisitEditDialog`. The `.flagged` CSS gives a striped background.

- [ ] **Step 1:** Tests: an open visit's event ends at `now`; a flagged unedited visit has class `flagged`, while an edited one doesn't; the colour comes from the project.
- [ ] **Step 2–4:** Fail → implement → pass; manual: the week view shows blocks at the correct Bangkok times.
- [ ] **Step 5: Commit** `feat(web): staff weekly timetable`.

### Task 11: Project summary and Export

**Files:**
- Create: `src/lib/summary.ts`, `src/lib/summary.test.ts`, `src/lib/export.ts`, `src/lib/export.test.ts`, `src/pages/manager/ProjectSummary.tsx`, `src/pages/manager/Export.tsx`

**Interfaces:**
- `api.ts` gains `listVisits(filter: { from: string; to: string; userId?: string; projectId?: string }): Promise<(Visit & {project: Project; profile: Profile})[]>` (`from`/`to` are Bangkok dates, converted to the UTC range `[from 00:00, to+1 00:00)`).
- `summary.ts`: `summarizeProject(visits): { rows: { userId, name, task, minutes }[]; perPerson: { userId, name, minutes }[]; totalMinutes }`. Rows group by user plus `task` trimmed and lower-cased (the first original spelling is displayed). Closed visits only.
- `export.ts`:
  - `buildExportRows(visits, lang): string[][]` with header (translated) `date, staff, project, check_in, check_out, hours, task, work_done, auto_closed, in_gps, out_gps`; hours as decimals with 2 places (`7.08`); GPS as `'lat,lng'` or `''`.
  - `toCsv(rows): string`: RFC 4180 quoting, `\r\n`, prefixed with `'﻿'` (Review Focus 4).
  - `toXlsx(rows): Blob` via SheetJS `utils.aoa_to_sheet`.
- ProjectSummary: project select and date range (default this week), a person × task table, per-person totals and a grand total.
- Export: date range, optional staff and project, and buttons Download .xlsx / .csv. The file name is `checkins_<from>_<to>.<ext>`.

- [ ] **Step 1:** Tests: `summarizeProject` merges `'Paint wall'` and `'paint wall '` for the same person and sums minutes, and ignores open visits; `buildExportRows` gives hours `'7.08'` for 425 min; `toCsv` starts with `'﻿'` and quotes a task containing a comma and a quote (`'a,"b"'` → `"a,""b"""`); Thai text round-trips.
- [ ] **Step 2–4:** Fail → implement → pass; manual: open the .xlsx and .csv in Excel or LibreOffice and check the Thai text is readable.
- [ ] **Step 5: Commit** `feat(web): project summary and export`.

### Task 12: Projects admin, QR printing, People admin

**Files:**
- Create: `src/pages/manager/Projects.tsx`, `src/pages/manager/ProjectQr.tsx`, `src/pages/manager/People.tsx`, `src/lib/colors.ts`, `src/lib/colors.test.ts`

**Interfaces:**
- `colors.ts`: `PALETTE: string[]` (10 distinguishable hex colours); `nextColor(used: string[]): string` returns the first unused colour, cycling when all are used.
- Projects: a list (active, plus a toggle for archived), a create/edit form (name, address, optional lat/lng, colour) and archive/unarchive. New projects get `nextColor`.
- ProjectQr (`/manager/projects/:id/qr`): an A4 print layout with a QR (`qrcode` → data URL, ≥ 12 cm), the project name, the text "Scan to check in / out · สแกนเพื่อเข้า-ออกงาน" and a print button; `@media print` hides the app chrome.
- People: a list of profiles with role and active toggles (`profiles` update, allowed for managers by Task 2) and an invite form calling the Task 5 function via `supabase.functions.invoke('invite', {body})`. A manager cannot change their own role or deactivate themselves (button disabled).

- [ ] **Step 1:** Tests for `nextColor`: `nextColor([])` = `PALETTE[0]`; it skips used colours; when all are used it returns `PALETTE[used.length % 10]`.
- [ ] **Step 2–4:** Fail → implement → pass; manual: print preview shows one clean page; an invite email arrives in Inbucket and the set-password link works.
- [ ] **Step 5: Commit** `feat(web): projects, QR print, people admin`.

### Task 13: End-to-end test, README and deploy docs

**Files:**
- Create: `web/e2e/checkin.spec.ts`, `web/playwright.config.ts`, `supabase/seed.sql`; Modify: `README.md`

**Interfaces:**
- `seed.sql`: manager `manager@example.com` / `password123`, staff `staff@example.com` / `password123`, projects `Site A` (code `sitea1`) and `Site B` (code `siteb1`). Local development only.
- The Playwright config uses `executablePath: '/opt/pw-browsers/chromium'` when present, and a base URL of the Vite dev server.

- [ ] **Step 1: Write the e2e test:** staff logs in → `/scan/sitea1` → enters task "Install tiles" → checks in → home shows "Site A" → `/scan/sitea1` → enters work done → checks out; manager logs in → Timetable → selects the staff member → an event containing "Install tiles" is visible; Export CSV download contains "Install tiles".
- [ ] **Step 2:** `npx supabase db reset && cd web && npx playwright test` → FAIL until wiring is complete, then PASS.
- [ ] **Step 3:** README covers what it is, local setup (`supabase start`, `db reset`, `web/.env`, `npm run dev`), tests (`supabase test db`, `vitest`, `playwright`), and deploy: create a Supabase project in the Singapore region, `supabase link`, `supabase db push`, `supabase functions deploy invite`, set the function secret `APP_URL`, set Auth → URL config site URL, deploy `web/` to Netlify/Vercel with the three `VITE_` env vars and SPA fallback (`web/public/_redirects`: `/* /index.html 200`), create the first manager in the dashboard and set their role to `manager` in SQL.
- [ ] **Step 4:** Run all three test suites green.
- [ ] **Step 5: Commit** `test: e2e check-in flow; docs: setup and deploy`.
