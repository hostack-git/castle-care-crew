/**
 * Client-side Google Sheets → Supabase rota importer.
 * Uses only the anon client (RLS-protected). No service role key needed.
 * Pure functions duplicated here to avoid importing createServerFn on the client.
 */
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";

const SHEET_ID = "1k7SwmRTv6qKljEfyjOBVOYkfQHed263ovFrP3gevbis";

const DEFAULT_TIMES: Record<string, { start: string; end: string }> = {
  Breakfast:       { start: "07:00", end: "12:00" },
  Housekeeping:    { start: "09:00", end: "15:00" },
  Laundry:         { start: "09:00", end: "15:00" },
  Cottages:        { start: "09:00", end: "15:00" },
  Maintenance:     { start: "09:00", end: "17:00" },
  "Special Task":  { start: "09:00", end: "15:00" },
  Onboarding:      { start: "09:00", end: "17:00" },
  Arrive:          { start: "09:00", end: "17:00" },
  "Deep Cleaning": { start: "09:00", end: "15:00" },
  "Family Dinner": { start: "18:00", end: "22:00" },
  "Family Dinners":{ start: "18:00", end: "22:00" },
};

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

// ---------- Week helpers ----------
const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function weekStartFromTab(tab: string): string {
  const m = tab.toUpperCase().match(/^(\d{1,2})\s*-\s*\d{1,2}\s+([A-Z]{3,})/);
  if (!m) throw new Error(`Unrecognized tab name: "${tab}"`);
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].slice(0, 3)];
  if (!mon) throw new Error(`Unknown month in tab: ${tab}`);
  return `2026-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysStr(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Generate the Google Sheet tab name for the week containing Monday `weekMon` (Date). */
export function tabNameForDate(weekMon: Date): string {
  const sun = new Date(weekMon);
  sun.setUTCDate(weekMon.getUTCDate() + 6);
  const d = weekMon.getUTCDate();
  const e = sun.getUTCDate();
  const mon = MONTH_ABBR[weekMon.getUTCMonth()];
  return `${d}-${e} ${mon}`;
}

/** Returns Monday of the ISO week containing `d`. */
export function startOfWeekMondayUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0=Sun
  const diff = (dow + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  return x;
}

// ---------- Shift normalization ----------
function normalizeCell(raw: string): { kind: "shift" | "off" | "empty"; name?: string } {
  const v = raw.trim();
  if (!v) return { kind: "empty" };
  const low = v.toLowerCase();
  if (low.startsWith("departure")) return { kind: "empty" };
  if (/^off(\s|\d|$)/i.test(v)) return { kind: "off" };
  const stripped = v.replace(/\s+\d+$/, "").trim();
  const canonical = stripped
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { kind: "shift", name: canonical };
}

// ---------- Rota CSV parser ----------
function parseRotaCSV(csv: string): Record<string, string[]> {
  const rows = parseCSV(csv);
  // Find the last "Name" header row
  const nameRowIdxs: number[] = [];
  rows.forEach((r, i) => { if ((r[0] ?? "").trim().toLowerCase() === "name") nameRowIdxs.push(i); });
  if (nameRowIdxs.length === 0) throw new Error("Header 'Name' not found in sheet tab");
  const startIdx = (nameRowIdxs[nameRowIdxs.length - 1]) + 1;

  const rota: Record<string, string[]> = {};
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[0] ?? "").trim();
    if (!name) break;
    const low = name.toLowerCase();
    if (low === "family dinner" || low === "activity") break;
    const cells = [r[1], r[2], r[3], r[4], r[5], r[6], r[7]].map((c) => (c ?? "").toString());
    rota[name] = cells;
  }
  return rota;
}

// ---------- Fetch ----------
async function fetchTabCSV(tab: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&headers=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status}) for tab "${tab}"`);
  const text = await res.text();
  if (text.trimStart().startsWith("<")) throw new Error(`Tab "${tab}" not found in the sheet`);
  return text;
}

// ---------- Main import ----------
export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  tabs: string[];
  errors: string[];
}

export async function importRotaFromSheets(tabs: string[]): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, tabs, errors: [] };

  // Load volunteers + templates once
  const [{ data: vols }, { data: tpls }] = await Promise.all([
    hostackSupabase
      .from("volunteers")
      .select("id, name, status")
      .eq("property_id", TORRIDONIA_PROPERTY_ID),
    hostackSupabase
      .from("shift_templates")
      .select("id, name, start_time, end_time")
      .eq("property_id", TORRIDONIA_PROPERTY_ID),
  ]);

  const norm = (s: string) => s.trim().toLowerCase();
  const volByName = new Map<string, string>(); // name → id
  for (const v of (vols ?? []) as { id: string; name: string }[]) {
    volByName.set(norm(v.name), v.id);
  }
  const tplByName = new Map<string, { id: string; start_time: string | null; end_time: string | null }>();
  for (const t of (tpls ?? []) as { id: string; name: string; start_time: string | null; end_time: string | null }[]) {
    tplByName.set(norm(t.name), t);
  }

  for (const tab of tabs) {
    try {
      const csv = await fetchTabCSV(tab);
      const rota = parseRotaCSV(csv);
      const weekStart = weekStartFromTab(tab);
      const days = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i));

      // Load existing shifts for this week
      const { data: existing } = await hostackSupabase
        .from("shifts")
        .select("id, volunteer_id, shift_date")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", days[0])
        .lte("shift_date", days[6]);

      const existingKey = new Map<string, string>(); // "volId__date" → shiftId
      for (const s of (existing ?? []) as { id: string; volunteer_id: string; shift_date: string }[]) {
        existingKey.set(`${s.volunteer_id}__${s.shift_date}`, s.id);
      }

      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

      for (const [volName, cells] of Object.entries(rota)) {
        const volId = volByName.get(norm(volName));
        if (!volId) {
          result.errors.push(`Volunteer not found: "${volName}" — skipped`);
          result.skipped++;
          continue;
        }

        for (let i = 0; i < 7; i++) {
          const cell = normalizeCell(cells[i] ?? "");
          if (cell.kind === "empty") continue;

          const date = days[i];
          const existingId = existingKey.get(`${volId}__${date}`);

          const isOff = cell.kind === "off";
          let tplId: string | null = null;
          let startTime = "00:00";
          let endTime = "00:00";

          if (!isOff && cell.name) {
            const tpl = tplByName.get(norm(cell.name));
            if (tpl) {
              tplId = tpl.id;
              startTime = tpl.start_time ?? DEFAULT_TIMES[cell.name]?.start ?? "09:00";
              endTime = tpl.end_time ?? DEFAULT_TIMES[cell.name]?.end ?? "17:00";
            } else {
              // Use default times even without template
              startTime = DEFAULT_TIMES[cell.name]?.start ?? "09:00";
              endTime = DEFAULT_TIMES[cell.name]?.end ?? "17:00";
            }
          }

          const payload = {
            property_id: TORRIDONIA_PROPERTY_ID,
            shift_date: date,
            volunteer_id: volId,
            shift_template_id: tplId,
            start_time: startTime,
            end_time: endTime,
            status: "scheduled",
          };

          if (existingId) {
            toUpdate.push({ id: existingId, data: payload });
          } else {
            toInsert.push(payload);
          }
        }
      }

      // Write: insert then update
      if (toInsert.length > 0) {
        const { error } = await hostackSupabase.from("shifts").insert(toInsert);
        if (error) result.errors.push(`Insert error (${tab}): ${error.message}`);
        else result.inserted += toInsert.length;
      }
      for (const { id, data } of toUpdate) {
        const { error } = await hostackSupabase.from("shifts").update(data).eq("id", id);
        if (error) result.errors.push(`Update error (${tab}, ${id}): ${error.message}`);
        else result.updated++;
      }
    } catch (err) {
      result.errors.push(`Tab "${tab}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
