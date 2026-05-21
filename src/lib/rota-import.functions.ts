import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const HOSTACK_URL = "https://yskzkobduekupiobrbxr.supabase.co";
const TORRIDONIA_PROPERTY_ID = "bf2720e8-eb8a-4c7e-9742-6b0dfe9e636a";

function hostackAdmin() {
  const key = process.env.HOSTACK_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("HOSTACK_SERVICE_ROLE_KEY missing");
  return createClient(HOSTACK_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Rota for week of 2026-05-18 (Mon -> Sun), parsed from the team's Google Sheet.
// Order: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
// "" = leave cell empty (do not insert). "Off" = scheduled with no template.
// "Departure" is treated as Off + note.
const WEEK_START = "2026-05-18";
const ROTA: Record<string, string[]> = {
  Pepe:    ["Maintenance", "Off", "Off", "Maintenance", "Maintenance", "Maintenance", "Maintenance"],
  Miguel:  ["Maintenance", "Maintenance", "Maintenance", "Off", "Off", "Maintenance", "Maintenance"],
  Nadia:   ["Laundry", "Off", "Departure", "", "", "", ""],
  Thais:   ["Breakfast", "Off", "Departure", "", "", "", ""],
  Helena:  ["Cottages", "Breakfast", "Breakfast", "Breakfast", "Off", "Off", "Breakfast"],
  Eva:     ["Cottages", "Housekeeping", "Housekeeping", "Housekeeping", "Off", "Off", "Housekeeping"],
  Charlie: ["Cottages", "Housekeeping", "Housekeeping", "Housekeeping", "Off", "Off", "Housekeeping"],
  River:   ["Housekeeping", "Off", "Off", "Off", "Off", "Special Task", "Special Task"],
  Molly:   ["Housekeeping", "Special Task", "Off", "Off", "Laundry", "Housekeeping", "Off"],
  Lotte:   ["Housekeeping", "Laundry", "Cottages", "Cottages", "Housekeeping", "Off", "Off"],
  Izzy:    ["Cottages", "Special Task", "Cottages", "Laundry", "Housekeeping", "Off", "Off"],
  Blanche: ["Arrive", "Onboarding", "Special Task", "Cottages", "Off", "Special Task", "Cottages"],
  Mike:    ["Arrive", "Onboarding", "Special Task", "Cottages", "Off", "Special Task", "Cottages"],
  Alexa:   ["", "", "", "Arrive", "Onboarding", "Housekeeping", "Cottages"],
  Roxana:  ["Special Task", "Special Task", "Laundry", "Off", "Off", "Breakfast", "Laundry"],
  Jorge:   ["Special Task", "Off", "Off", "Special Task", "Special Task", "Special Task", "Special Task"],
};

// Most common shift -> role_type (for newly created volunteers)
function dominantRole(shifts: string[]): string {
  const counts: Record<string, number> = {};
  for (const s of shifts) {
    if (!s || s === "Off" || s === "Departure") continue;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  let best = "Housekeeping";
  let bestN = 0;
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_TIMES: Record<string, { start: string; end: string }> = {
  Breakfast:     { start: "07:00", end: "12:00" },
  Housekeeping:  { start: "09:00", end: "15:00" },
  Laundry:       { start: "09:00", end: "15:00" },
  Cottages:      { start: "09:00", end: "15:00" },
  Maintenance:   { start: "09:00", end: "17:00" },
  "Special Task":{ start: "09:00", end: "15:00" },
  Onboarding:    { start: "09:00", end: "17:00" },
  Arrive:        { start: "09:00", end: "17:00" },
};

export const importTorridoniaRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin check via main project
    const { data: isAdminRow } = await supabaseAdmin.rpc("is_admin", { _user_id: context.userId });
    if (!isAdminRow) throw new Error("Not authorized");

    const sb = hostackAdmin();

    // 1) Load existing volunteers & templates
    const [volRes, tplRes] = await Promise.all([
      sb.from("volunteers").select("id, name, status, role_type").eq("property_id", TORRIDONIA_PROPERTY_ID),
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

    let volsCreated = 0;
    let volsReactivated = 0;
    let tplsCreated = 0;

    // 2) Ensure each volunteer exists & is active
    const volIds: Record<string, string> = {};
    for (const [name, shifts] of Object.entries(ROTA)) {
      const existing = volByName.get(norm(name));
      if (existing) {
        volIds[name] = existing.id;
        if (existing.status !== "active") {
          await sb.from("volunteers").update({ status: "active" }).eq("id", existing.id);
          volsReactivated++;
        }
      } else {
        const ins = await sb.from("volunteers").insert({
          property_id: TORRIDONIA_PROPERTY_ID,
          name,
          status: "active",
          role_type: dominantRole(shifts),
        }).select("id").single();
        if (ins.error) throw new Error(`create volunteer ${name}: ${ins.error.message}`);
        volIds[name] = ins.data.id as string;
        volsCreated++;
      }
    }

    // 3) Ensure each shift template exists
    const usedShiftNames = new Set<string>();
    for (const shifts of Object.values(ROTA)) {
      for (const s of shifts) {
        if (s && s !== "Off" && s !== "Departure") usedShiftNames.add(s);
      }
    }
    const tplIds: Record<string, { id: string; start_time: string | null; end_time: string | null }> = {};
    for (const name of usedShiftNames) {
      const existing = tplByName.get(norm(name));
      if (existing) {
        tplIds[name] = existing;
      } else {
        const t = DEFAULT_TIMES[name] ?? { start: "09:00", end: "17:00" };
        const ins = await sb.from("shift_templates").insert({
          property_id: TORRIDONIA_PROPERTY_ID,
          name,
          start_time: t.start,
          end_time: t.end,
        }).select("id, start_time, end_time").single();
        if (ins.error) throw new Error(`create template ${name}: ${ins.error.message}`);
        tplIds[name] = { id: ins.data.id as string, start_time: ins.data.start_time, end_time: ins.data.end_time };
        tplsCreated++;
      }
    }

    // 4) Build shift rows and upsert by (volunteer_id, shift_date)
    const days = Array.from({ length: 7 }, (_, i) => addDays(WEEK_START, i));

    // Fetch existing shifts in that week to compute id for upserts
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
    for (const [name, shifts] of Object.entries(ROTA)) {
      const vid = volIds[name];
      for (let i = 0; i < 7; i++) {
        const cell = shifts[i];
        if (!cell) continue;
        const date = days[i];
        const key = `${vid}__${date}`;
        const id = existingId.get(key);
        if (cell === "Off" || cell === "Departure") {
          rows.push({
            ...(id ? { id } : {}),
            property_id: TORRIDONIA_PROPERTY_ID,
            volunteer_id: vid,
            shift_date: date,
            shift_template_id: null,
            start_time: null,
            end_time: null,
            status: "scheduled",
            notes: cell === "Departure" ? "Departure" : null,
          });
        } else {
          const tpl = tplIds[cell];
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

    const { error: upErr } = await sb.from("shifts").upsert(rows);
    if (upErr) {
      // Retry without notes column if it doesn't exist
      if (/column .*notes/i.test(upErr.message)) {
        const rows2 = rows.map((r) => {
          const { notes: _drop, ...rest } = r as Record<string, unknown> & { notes?: unknown };
          return rest;
        });
        const retry = await sb.from("shifts").upsert(rows2);
        if (retry.error) throw new Error("upsert shifts (retry): " + retry.error.message);
      } else {
        throw new Error("upsert shifts: " + upErr.message);
      }
    }

    return {
      weekStart: WEEK_START,
      volunteersTotal: Object.keys(ROTA).length,
      volunteersCreated: volsCreated,
      volunteersReactivated: volsReactivated,
      templatesCreated: tplsCreated,
      shiftsUpserted: shiftsPlanned,
    };
  });
