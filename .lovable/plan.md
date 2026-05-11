## Weekly Rota Builder — Plan

A new Admin module that replaces one-by-one task creation with a spreadsheet-like weekly grid, then auto-generates tasks for volunteers.

### 1. Database (new tables via migration)

- `weekly_rotas` — one row per week. Fields: `week_start` (date, Monday), `status` ('draft' | 'published'), `created_by`, `published_at`.
- `rota_room_cells` — one cell per room × day. Fields: `rota_id`, `room_id` (FK rooms), `day` (date), `status` (enum: to_clean, check_in, staying, free, maintenance).
- `rota_team_cells` — one cell per volunteer × day. Fields: `rota_id`, `user_id`, `day`, `assignment` (enum), `note`.
- `rota_checkins` — one row per day. Fields: `rota_id`, `day`, `responsible_id`.
- `task_templates` — editable checklist templates. Fields: `kind` (room_clean, cottage_clean, breakfast, checkin, maintenance, deep_clean, onboarding), `items` (text[]).
- `generated_tasks` — link rota cell → created `tasks.id` for idempotency. Unique on (rota_id, day, scope_key) so re-generation can upsert without duplicates.

All tables RLS: SELECT for signed-in, ALL for admin.

Seed `task_templates` with the checklists from the spec.

### 2. Routes

- `src/routes/app.admin.rota.tsx` — Weekly Rota Builder (the main grid).
- `src/routes/app.admin.templates.tsx` — Edit checklist templates.
- Add sidebar links in `app.admin.tsx`.

### 3. UI — Weekly Rota Builder

Header with title + subtitle, action buttons (Duplicate last week / Import CSV / Save draft / Generate Tasks).

Grid with 3 sections (Room Rota, Team Rota, Check-ins), 7 day columns. Each cell is a compact dropdown styled as a colored pill matching the reference image:
- Room statuses: to_clean=red, check_in=light green, staying=blue, free=grey, maintenance=orange.
- Team assignments: housekeeping, cottages, breakfast, maintenance, off, special, onboarding, deep_clean, departure, arrive — each with its own pill color.

Right-side summary panel: counts (auto-gen tasks, rooms to clean, expected check-ins, volunteers off), "Ready to generate" status, View preview button.

Week navigator (prev/next, current Monday–Sunday range).

Color tokens added to `src/styles.css` as semantic rota tokens.

### 4. Behavior

- Cell edits autosave to the right `rota_*_cells` table (upsert keyed by rota+day+row).
- "Duplicate last week": copy all cells from previous Monday into current rota.
- "Save draft": sets `status='draft'` (default).
- "Generate Tasks": confirm dialog → server function loops cells and inserts into `tasks` + `task_checklist_items`, recording `generated_tasks` rows. Re-running upserts (skips if already generated for that scope_key, or deletes+regenerates if user confirms).
- "Publish": sets `status='published'` so volunteers see them on dashboard (tasks already feed dashboard via existing flow).
- Import CSV: deferred — wire button but show "coming soon" toast (out of scope for first cut).

### 5. Generation logic (server)

Implemented as a `createServerFn` (admin-only, checks `is_admin`). For each day:
- For each room with `to_clean`: insert task type=`housekeeping` (rooms) or `cottages`, title="Clean {room name}", checklist from matching template.
- For each room with `check_in`: insert check-in prep task with checkin template.
- For each volunteer assignment: create matching task assigned to that volunteer (breakfast, maintenance, etc.). Housekeeping/Cottages volunteers get tasks linked to all rooms/cottages marked `to_clean` that day (one task with combined checklist or one per unit — one per unit, assigned).
- Check-ins row: assign a "Daily check-ins" task to the responsible volunteer.

Idempotency via `generated_tasks (rota_id, day, scope_key)` unique. `scope_key` = e.g. `room:<id>:to_clean` or `vol:<id>:breakfast`.

### 6. Sidebar submenu

Update `app.admin.tsx` header to show submenu links: Team / Volunteers / Rooms & Cottages / Weekly Rota Builder / Tasks / Settings (link to existing pages where they exist; placeholders are fine for missing ones).

### Technical notes

- Server function in `src/lib/rota.functions.ts` using `requireSupabaseAuth` middleware (admin check inside).
- Realtime not required — autosave is enough.
- Color pills: shared `<RotaPill>` component using semantic tokens; dropdown via shadcn `Select` styled as pill.
- Mobile: grid scrolls horizontally (sticky first column).

### Deliverable scope

In: DB migration, rota page with grid + autosave + duplicate week + generate, summary panel, templates page, sidebar submenu.
Out (for follow-up): CSV import, publish/unpublish workflow distinct from generate (treated as one flow for now), drag-fill, undo history.