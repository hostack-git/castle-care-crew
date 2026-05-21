import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const HOSTACK_URL = "https://yskzkobduekupiobrbxr.supabase.co";
const HOSTACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlza3prb2JkdWVrdXBpb2JyYnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjAxNjAsImV4cCI6MjA5MDEzNjE2MH0.5t6mm90F7k_8zXVVzUJAYzFA4IoNdTm6-UTRWFzsjfg";
const TORRIDONIA_PROPERTY_ID = "bf2720e8-eb8a-4c7e-9742-6b0dfe9e636a";
const SHEET_ID = "1k7SwmRTv6qKljEfyjOBVOYkfQHed263ovFrP3gevbis";
const SHEET_YEAR = 2026;
const MANAGER_EMAILS = new Set(["jorge.ibanez.ciej@gmail.com"]);

function hostackAdmin() {
  const key = process.env.HOSTACK_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("HOSTACK_SERVICE_ROLE_KEY missing");
  return createClient(HOSTACK_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hostackAuth() {
  return createClient(HOSTACK_URL, HOSTACK_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertHostackManager(accessToken: string) {
  const { data, error } = await hostackAuth().auth.getUser(accessToken);
  if (error || !data.user) throw new Error(error?.message ?? "Invalid session");
  const email = data.user.email?.toLowerCase() ?? "";
  if (MANAGER_EMAILS.has(email)) return;
  const { data: staff, error: staffError } = await hostackAdmin()
    .from("staff")
    .select("role,status")
    .eq("property_id", TORRIDONIA_PROPERTY_ID)
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (staffError) throw new Error(staffError.message);
  const role = ((staff?.role as string | null) ?? "").toLowerCase();
  if (staff?.status === "active" && (role.includes("manager") || role === "admin" || role === "owner")) return;
  throw new Error("Not authorized");
}

// ---------- CSV ----------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

// ---------- Week start from tab name ----------
const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
function weekStartFromTab(tab: string): string {
  const m = tab.toUpperCase().match(/^(\d{1,2})\s*-\s*\d{1,2}\s+([A-Z]{3,})/);
  if (!m) throw new Error(`Unrecognized tab name: ${tab}`);
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].slice(0, 3)];
  if (!mon) throw new Error(`Unknown month in tab: ${tab}`);
  return `${SHEET_YEAR}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- Shift normalization ----------
const DEFAULT_TIMES: Record<string, { start: string; end: string }> = {
  Breakfast:      { start: "07:00", end: "12:00" },
  Housekeeping:   { start: "09:00", end: "15:00" },
  Laundry:        { start: "09:00", end: "15:00" },
  Cottages:       { start: "09:00", end: "15:00" },
  Maintenance:    { start: "09:00", end: "17:00" },
  "Special Task": { start: "09:00", end: "15:00" },
  Onboarding:     { start: "09:00", end: "17:00" },
  Arrive:         { start: "09:00", end: "17:00" },
  "Deep Cleaning":{ start: "09:00", end: "15:00" },
};

// Normalize cell text -> canonical shift name (or "Off" / "" )
function normalizeCell(raw: string): { kind: "shift" | "off" | "empty"; name?: string; note?: string } {
  const v = raw.trim();
  if (!v) return { kind: "empty" };
  const low = v.toLowerCase();
  if (low.startsWith("departure")) return { kind: "empty" }; // skip departure cells
  if (/^off(\s|\d|$)/i.test(v)) return { kind: "off" };
  // Strip trailing " 2", " 3"… that indicates multi-shift markers in the sheet
  const stripped = v.replace(/\s+\d+$/, "").trim();
  // Title-case to match template names
  const canonical = stripped
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { kind: "shift", name: canonical };
}

function dominantRole(cells: string[]): string {
  const counts: Record<string, number> = {};
  for (const c of cells) {
    const n = normalizeCell(c);
    if (n.kind === "shift" && n.name) counts[n.name] = (counts[n.name] ?? 0) + 1;
  }
  let best = "Housekeeping";
  let bestN = 0;
  for (const [k, n] of Object.entries(counts)) if (n > bestN) { best = k; bestN = n; }
  return best;
}

// ---------- Parse one tab's CSV into a rota ----------
function parseRotaCSV(csv: string): { rota: Record<string, string[]> } {
  const rows = parseCSV(csv);
  // Find the SECOND "Name" header row (after "CHECK INS")
  const nameRowIdxs: number[] = [];
  rows.forEach((r, i) => { if ((r[0] ?? "").trim().toLowerCase() === "name") nameRowIdxs.push(i); });
  if (nameRowIdxs.length === 0) throw new Error("Staff header 'Name' not found in sheet tab");
  const startIdx = (nameRowIdxs[1] ?? nameRowIdxs[0]) + 1;

  const rota: Record<string, string[]> = {};
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[0] ?? "").trim();
    if (!name) break;
    const lowerName = name.toLowerCase();
    if (lowerName === "family dinner" || lowerName === "activity") break;
    // Take 7 cells (Mon..Sun)
    const cells = [r[1], r[2], r[3], r[4], r[5], r[6], r[7]].map((c) => (c ?? "").toString());
    rota[name] = cells;
  }
  return { rota };
}

async function fetchTabCSV(tab: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&headers=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status}) for tab "${tab}"`);
  const text = await res.text();
  if (text.startsWith("<")) throw new Error(`Tab "${tab}" not found in the sheet`);
  return text;
}

// ---------- Server function ----------
const InputSchema = z.object({
  accessToken: z.string().min(10),
  tabs: z.array(z.string().min(1)).min(1).max(8),
});

export const importTorridoniaRota = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    await assertHostackManager(data.accessToken.trim());

    const sb = hostackAdmin();

    // Parse every requested tab first
    const tabs: { tab: string; weekStart: string; rota: Record<string, string[]> }[] = [];
    for (const tab of data.tabs) {
      const csv = await fetchTabCSV(tab);
      const { rota } = parseRotaCSV(csv);
      tabs.push({ tab, weekStart: weekStartFromTab(tab), rota });
    }

    // Load existing volunteers & templates (single fetch)
    const [volRes, tplRes] = await Promise.all([
      sb.from("volunteers").select("id, name, status").eq("property_id", TORRIDONIA_PROPERTY_ID),
      sb.from("shift_templates").select("id, name, start_time, end_time").eq("property_id", TORRIDONIA_PROPERTY_ID),
    ]);
    if (volRes.error) throw new Error("volunteers: " + volRes.error.message);
    if (tplRes.error) throw new Error("shift_templates: " + tplRes.error.message);

    const norm = (s: string) => s.trim().toLowerCase();
    const volByName = new Map<string, { id: string; status: string | null }>();
    for (const v of (volRes.data ?? []) as { id: string; name: string; status: string | null }[]) {
      volByName.set(norm(v.name), { id: v.id, status: v.status });
    }
    const tplByName = new Map<string, { id: string; start_time: string | null; end_time: string | null }>();
    for (const t of (tplRes.data ?? []) as { id: string; name: string; start_time: string | null; end_time: string | null }[]) {
      tplByName.set(norm(t.name), { id: t.id, start_time: t.start_time, end_time: t.end_time });
    }

    let volsCreated = 0, volsReactivated = 0, tplsCreated = 0;
    const volIds: Record<string, string> = {};
    const tplCache: Record<string, { id: string; start_time: string | null; end_time: string | null }> = {};

    const ensureVolunteer = async (name: string, cells: string[]) => {
      if (volIds[name]) return volIds[name];
      const ex = volByName.get(norm(name));
      if (ex) {
        volIds[name] = ex.id;
        if (ex.status !== "active") {
          await sb.from("volunteers").update({ status: "active" }).eq("id", ex.id);
          volsReactivated++;
        }
      } else {
        const ins = await sb.from("volunteers").insert({
          property_id: TORRIDONIA_PROPERTY_ID,
          name,
          status: "active",
          role_type: dominantRole(cells),
          start_date: "2026-05-18",
          end_date: "2026-12-31",
        }).select("id").single();
        if (ins.error) throw new Error(`create volunteer ${name}: ${ins.error.message}`);
        volIds[name] = ins.data.id as string;
        volsCreated++;
      }
      return volIds[name];
    };

    const ensureTemplate = async (name: string) => {
      if (tplCache[name]) return tplCache[name];
      const ex = tplByName.get(norm(name));
      if (ex) { tplCache[name] = ex; return ex; }
      const t = DEFAULT_TIMES[name] ?? { start: "09:00", end: "17:00" };
      const ins = await sb.from("shift_templates").insert({
        property_id: TORRIDONIA_PROPERTY_ID,
        name,
        start_time: t.start,
        end_time: t.end,
      }).select("id, start_time, end_time").single();
      if (ins.error) throw new Error(`create template ${name}: ${ins.error.message}`);
      const row = { id: ins.data.id as string, start_time: ins.data.start_time, end_time: ins.data.end_time };
      tplCache[name] = row;
      tplsCreated++;
      return row;
    };

    const perTab: { tab: string; weekStart: string; shifts: number }[] = [];

    for (const { tab, weekStart, rota } of tabs) {
      const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

      // Existing shifts in this week
      const { data: existingShifts, error: exErr } = await sb
        .from("shifts")
        .select("id, volunteer_id, shift_date")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", days[0])
        .lte("shift_date", days[6]);
      if (exErr) throw new Error("existing shifts: " + exErr.message);
      const existingId = new Map<string, string>();
      for (const s of (existingShifts ?? []) as { id: string; volunteer_id: string; shift_date: string }[]) {
        existingId.set(`${s.volunteer_id}__${s.shift_date}`, s.id);
      }

      const rows: Record<string, unknown>[] = [];
      let shiftsPlanned = 0;

      for (const [name, cells] of Object.entries(rota)) {
        const vid = await ensureVolunteer(name, cells);
        for (let i = 0; i < 7; i++) {
          const n = normalizeCell(cells[i] ?? "");
          if (n.kind === "empty") continue;
          const date = days[i];
          const id = existingId.get(`${vid}__${date}`);
          if (n.kind === "off") {
            rows.push({
              ...(id ? { id } : {}),
              property_id: TORRIDONIA_PROPERTY_ID,
              volunteer_id: vid,
              shift_date: date,
              shift_template_id: null,
              start_time: "00:00",
              end_time: "00:00",
              status: "scheduled",
            });
          } else if (n.kind === "shift" && n.name) {
            const tpl = await ensureTemplate(n.name);
            rows.push({
              ...(id ? { id } : {}),
              property_id: TORRIDONIA_PROPERTY_ID,
              volunteer_id: vid,
              shift_date: date,
              shift_template_id: tpl.id,
              start_time: tpl.start_time,
              end_time: tpl.end_time,
              status: "scheduled",
            });
          }
          shiftsPlanned++;
        }
      }

      if (rows.length > 0) {
        const { error: upErr } = await sb.from("shifts").upsert(rows);
        if (upErr) throw new Error(`upsert shifts (${tab}): ${upErr.message}`);
      }
      perTab.push({ tab, weekStart, shifts: shiftsPlanned });
    }

    return {
      tabs: perTab,
      volunteersCreated: volsCreated,
      volunteersReactivated: volsReactivated,
      templatesCreated: tplsCreated,
    };
  });
