# Staff QR Check-in — Design

Date: 2026-10-19
Status: Draft, awaiting review

## Goal

Staff scan a QR code posted at each project site when they arrive and when they leave, and write down the task they are doing. The app records each visit and turns the records into a timetable for every staff member, showing which projects they visited, what they did there and how long they stayed. Managers also get per-project summaries, a live "who is on site" view and Excel/CSV export.

## Decisions

| Topic | Decision |
| --- | --- |
| Identity | Each staff member logs in once on their own phone and stays logged in. No shared devices or badges. |
| Platform | Web app used in the phone browser. Nothing to install. |
| Backend | Supabase (Auth + Postgres + row-level security + scheduled jobs). |
| Frontend | React + Vite + TypeScript, hosted on Netlify or Vercel (free tier). |
| Task entry | Task is entered at check-in and can be edited, with "work done" added, at check-out. |
| Forgotten check-out | Checking in at another project auto-closes the open visit. Visits still open at 23:59 are auto-closed. Both are flagged for the manager. |
| GPS | Recorded with every scan and shown to managers. Never blocks a scan. |
| Time zone | Asia/Bangkok for all display, day boundaries and the auto-close job. Timestamps are stored as `timestamptz` (UTC). |
| Language | English and Thai, with a switch in the app. The choice is remembered per user. |
| Staff visibility | Staff see only their own history. Managers see everything. |

## Roles

- **staff**: scan in and out, write tasks, view their own history.
- **manager**: everything staff can do, plus all reports, editing visits, managing projects and inviting users.

## Data model (Postgres, `public` schema)

### `profiles`
One row per auth user, created by a trigger on `auth.users` insert.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | = `auth.users.id` |
| `full_name` | text not null | |
| `role` | text not null | `'staff'` or `'manager'`, default `'staff'` |
| `language` | text not null | `'en'` or `'th'`, default `'th'` |
| `active` | boolean not null | default true. Inactive users cannot scan. |

### `projects`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `code` | text unique not null | Short random slug in the QR link, e.g. `k7f3qp`. |
| `name` | text not null | |
| `address` | text | |
| `lat`, `lng` | double precision | Optional site location, shown next to scan GPS. |
| `color` | text not null | Hex colour for timetable blocks. Assigned automatically, editable. |
| `archived` | boolean not null | default false. Archived projects reject scans. |

### `visits`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid not null → profiles | |
| `project_id` | uuid not null → projects | |
| `check_in_at` | timestamptz not null | Set by the server (`now()`), never by the client. |
| `check_out_at` | timestamptz | null while open. |
| `task` | text not null | Entered at check-in. |
| `work_done` | text | Entered at check-out. |
| `in_lat`, `in_lng`, `in_accuracy_m` | double precision | Null if the phone refused location. |
| `out_lat`, `out_lng`, `out_accuracy_m` | double precision | |
| `auto_closed` | text | null, `'switched_project'` or `'end_of_day'`. |
| `edited_by` | uuid → profiles | Last manager who edited the times. |
| `edited_at` | timestamptz | |

Constraints:
- A partial unique index on `visits(user_id) where check_out_at is null` guarantees at most one open visit per person.
- `check_out_at > check_in_at` when it is not null.

Duration is computed (`check_out_at - check_in_at`), not stored.

## Scan flow

QR codes encode `https://<app-host>/scan/<project-code>`. Staff can scan with the in-app scanner (`html5-qrcode`) or with the phone's normal camera, which opens the same link. If they are not logged in, they log in and return to the same link.

All writes go through two Postgres functions (`security definer`, callable over Supabase RPC) so the rules live in one place and timestamps come from the server:

**`scan_in(project_code, task, lat, lng, accuracy)`**
1. Reject if the user is inactive, the project is unknown or archived, or the task is empty.
2. If the user has an open visit at the **same** project, return it with `status = 'already_in'`. The client then shows the check-out form.
3. If the user has an open visit at a **different** project, close it with `check_out_at = now()` and `auto_closed = 'switched_project'`.
4. Insert the new visit and return it with `status = 'checked_in'`.

**`scan_out(visit_id, task, work_done, lat, lng, accuracy)`**
1. Reject unless the visit belongs to the caller and is still open.
2. Set `check_out_at = now()` and the GPS fields, and update `task` and `work_done`.

**Client logic after scanning project P:**
- Open visit at P → show the check-out form (task pre-filled, plus a "work done" box) → `scan_out`.
- Otherwise → show the check-in form. If an open visit exists elsewhere, warn: "This will check you out of <other project>" → `scan_in`.

The home screen shows the current open visit, with a **Check out** button that works without scanning (for example when the QR code has gone missing). It calls the same `scan_out` function and records out-GPS the same way.

GPS: the client requests `navigator.geolocation` with a 10-second timeout. If it is denied or times out, the scan continues with null coordinates.

**End-of-day auto-close:** a `pg_cron` job runs at 23:59 Asia/Bangkok (16:59 UTC). It sets `check_out_at = now()` and `auto_closed = 'end_of_day'` on every open visit.

**Manager edits:** managers can change `check_in_at`, `check_out_at`, `task` and `work_done` on any visit (via `update_visit` RPC), which records `edited_by` and `edited_at`. Editing a flagged visit keeps the `auto_closed` value so the history stays visible, and the UI shows it as "fixed".

## Access rules (row-level security)

- `profiles`: users read and update their own `full_name` and `language`. Managers read all profiles and update `role` and `active`. Nobody can change their own role.
- `projects`: any logged-in active user can read non-archived projects. Only managers insert and update.
- `visits`: staff `select` only rows where `user_id = auth.uid()`. There are no direct `insert`, `update` or `delete` grants for anyone. All writes go through the RPC functions above, which check the caller's role. Managers can `select` all rows.
- Inviting users uses Supabase's invite email, triggered through a Supabase Edge Function that checks the caller is a manager, so the service key never reaches the browser.

## Screens

Both languages throughout (`i18next`, JSON files `en.json` and `th.json`). Dates and times are shown in Asia/Bangkok, with Buddhist-era years in Thai mode (`th-TH` locale).

### Staff (mobile-first)
- **Login:** email and password, plus a "set password" page from the invite link.
- **Home:** a large **Scan** button. If checked in: project name, "since 08:12", elapsed time and a **Check out** button.
- **Scan:** the camera view, then the check-in form (task) or the check-out form (task + work done).
- **My history:** visits grouped by day, with project, task and hours, and totals per day and per week. Flagged visits show a note.
- **Settings:** language switch and log out.

### Manager (phone or desktop)
- **On site now:** open visits grouped by project, with names and check-in times. Refreshes live via Supabase Realtime.
- **Staff timetable:** pick a person and a week to see a `FullCalendar` week grid (time grid, 06:00–22:00 by default, expandable). There is one block per visit, coloured by project, labelled with project and task. Clicking a block opens details (times, task, work done, GPS on a map link) and an edit form. Flagged visits have a striped or warning style.
- **Project summary:** pick a project and a date range to see a table of person × task with hours, and totals per person and overall.
- **Needs review:** a list of auto-closed visits not yet edited.
- **Export:** a date range plus optional staff and project filters. Downloads `.xlsx` (SheetJS) or `.csv` with columns for date, staff, project, check-in, check-out, hours (decimal), task, work done, auto-closed and GPS.
- **Projects:** add, edit or archive projects, and print the QR code. The print page has one large QR code with the project name in Thai and English, sized for A4.
- **People:** invite by email, set name and role, deactivate.

## Error handling

- Offline at scan time: the form stays open with a clear "No connection, try again" message. There is no offline queue, because server timestamps are the source of truth (YAGNI for v1).
- Camera permission denied: show instructions and a link to scan with the phone's own camera instead.
- RPC errors map to translated messages: unknown project, archived project, inactive account, visit already closed.
- The scan link is idempotent: reloading `/scan/<code>` never creates a second visit (guaranteed by the unique open-visit index and `already_in`).

## Testing

- **Database:** SQL tests with pgTAP, run against the local Supabase stack (`supabase test db`). They cover `scan_in` and `scan_out` (same project, switching projects, inactive user, archived project), the auto-close job, manager edits, and RLS (staff cannot read others' visits or write directly).
- **Frontend:** Vitest for pure logic (duration formatting, Bangkok day grouping, week totals, export rows, Thai/English formatting) and React Testing Library for the scan forms.
- **End-to-end:** one Playwright run of invite → log in → scan in → scan out → manager sees the block in the timetable.

## Repository layout

```
supabase/
  migrations/      schema, RLS, functions, cron job
  functions/invite/ Edge Function for inviting staff
  tests/           pgTAP tests
web/
  src/
    pages/staff/   Home, Scan, History, Settings
    pages/manager/ OnSite, Timetable, ProjectSummary, Review, Export, Projects, People
    lib/           supabase client, time helpers, export builders
    i18n/          en.json, th.json
  tests/
docs/
```

## Deployment

- A Supabase project in the Singapore region (closest to Thailand). The migrations are applied with the Supabase CLI.
- The web app is deployed to Netlify or Vercel with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The first manager account is created by hand in Supabase, and every other user is invited from the app.

## Out of scope for v1

Offline scanning, native apps, payroll calculations (overtime, pay rates), shift planning, geofence blocking, photos with check-in, and push notifications.
