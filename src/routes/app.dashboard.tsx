import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, LOCALE_MAP } from "@/lib/i18n";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Calendar, Clock, CheckCircle2, Circle, BookOpen, ChevronLeft, ChevronRight, MessageCircle, Plus, X, LogIn, LogOut, Search, Copy } from "lucide-react";
import { startOfWeekMondayUTC } from "@/lib/rota-utils";
import { loadTodaysRooms, type RoomEntry } from "@/lib/amenitiz-parser";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dashboard")({ component: DashboardRoute });

const WHATSAPP_URL = "https://chat.whatsapp.com/DvsSz15BQp98Zl8mQRIMLp";

type VolColor = { chip: string; dot: string };
const VOL_PALETTE: VolColor[] = [
  { chip: "bg-violet-100 text-violet-800",   dot: "bg-violet-400" },
  { chip: "bg-sky-100 text-sky-800",         dot: "bg-sky-400" },
  { chip: "bg-teal-100 text-teal-800",       dot: "bg-teal-400" },
  { chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-400" },
  { chip: "bg-amber-100 text-amber-800",     dot: "bg-amber-400" },
  { chip: "bg-orange-100 text-orange-800",   dot: "bg-orange-400" },
  { chip: "bg-rose-100 text-rose-800",       dot: "bg-rose-400" },
  { chip: "bg-pink-100 text-pink-800",       dot: "bg-pink-400" },
  { chip: "bg-indigo-100 text-indigo-800",   dot: "bg-indigo-400" },
  { chip: "bg-cyan-100 text-cyan-800",       dot: "bg-cyan-400" },
  { chip: "bg-lime-100 text-lime-800",       dot: "bg-lime-400" },
  { chip: "bg-red-100 text-red-800",         dot: "bg-red-400" },
  { chip: "bg-fuchsia-100 text-fuchsia-800", dot: "bg-fuchsia-400" },
  { chip: "bg-yellow-100 text-yellow-800",   dot: "bg-yellow-400" },
  { chip: "bg-green-100 text-green-800",     dot: "bg-green-400" },
  { chip: "bg-blue-100 text-blue-800",       dot: "bg-blue-400" },
];

type ShiftTemplate = { name: string | null; start_time: string | null; end_time: string | null };
type Shift = {
  id: string;
  shift_date: string;
  shift_templates: ShiftTemplate | ShiftTemplate[] | null;
};
type Task = {
  id: string;
  title: string;
  status: string;
  due_time: string | null;
  notes: string | null;
};

function pickTemplate(t: Shift["shift_templates"]): ShiftTemplate | null {
  if (!t) return null;
  return Array.isArray(t) ? t[0] ?? null : t;
}

function DashboardRoute() {
  const { user, loading, isVolunteer } = useAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user) return null;
  if (isVolunteer) return <VolunteerDashboard />;
  return <Dashboard />;
}

type VolShift = {
  id: string;
  shift_date: string;
  shift_templates: ShiftTemplate | ShiftTemplate[] | null;
};

const TYPE_COLORS: { match: string; cls: string }[] = [
  { match: "breakfast",    cls: "bg-orange-100 text-orange-900 border-orange-200" },
  { match: "housekeep",   cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  { match: "laundry",     cls: "bg-blue-100 text-blue-900 border-blue-200" },
  { match: "cottage",     cls: "bg-teal-100 text-teal-900 border-teal-200" },
  { match: "maintenance", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  { match: "deep",        cls: "bg-purple-100 text-purple-900 border-purple-200" },
  { match: "special",     cls: "bg-red-100 text-red-900 border-red-200" },
  { match: "family",      cls: "bg-pink-100 text-pink-900 border-pink-200" },
  { match: "dinner",      cls: "bg-pink-100 text-pink-900 border-pink-200" },
];
function shiftColor(name: string | null | undefined) {
  if (!name) return "bg-muted/40 text-muted-foreground border-border";
  const n = name.toLowerCase();
  for (const t of TYPE_COLORS) if (n.includes(t.match)) return t.cls;
  return "bg-secondary text-secondary-foreground border-border";
}

function ymdDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ── Volunteer dashboard ────────────────────────────────────────────────────

function VolunteerDashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<VolShift[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMondayUTC(new Date()));
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomEntry[] | null>(null);

  const locale = LOCALE_MAP[lang] ?? "en-GB";
  const name =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email?.split("@")[0] ||
    t("dash.friend");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setUTCDate(weekStart.getUTCDate() + i); return d; }),
    [weekStart]
  );
  const startStr = ymdDate(days[0]);
  const endStr = ymdDate(days[6]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    loadTodaysRooms(today).then((r) => setRooms(r)).catch(() => setRooms(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: volByAuth } = await hostackSupabase
        .from("volunteers")
        .select("id")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (volByAuth?.id) { setVolunteerId(volByAuth.id); return; }
      const fullName = (user.user_metadata as { full_name?: string } | undefined)?.full_name;
      if (fullName) {
        const { data: volByName } = await hostackSupabase
          .from("volunteers")
          .select("id")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .ilike("name", fullName)
          .maybeSingle();
        if (volByName?.id) setVolunteerId(volByName.id);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      let query = hostackSupabase
        .from("shifts")
        .select("id, shift_date, shift_templates(name, start_time, end_time)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", startStr)
        .lte("shift_date", endStr)
        .order("shift_date", { ascending: true });
      if (volunteerId) query = query.eq("volunteer_id", volunteerId);
      const { data } = await query;
      if (!cancelled) {
        setShifts((data as VolShift[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, volunteerId, startStr, endStr]);

  const fmtTime = (v: string | null) => (v ? v.slice(0, 5) : "");
  const isCurrentWeek = ymdDate(startOfWeekMondayUTC(new Date())) === startStr;
  const shiftByDate = new Map(shifts.map((s) => [s.shift_date, s]));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="font-display text-4xl font-semibold mt-1">{t("dash.hi")}, {name}! 👋</h1>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" /> {t("dash.myShifts")}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setWeekStart((w) => { const d = new Date(w); d.setUTCDate(w.getUTCDate() - 7); return d; })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs px-2"
              onClick={() => setWeekStart(startOfWeekMondayUTC(new Date()))}>
              {isCurrentWeek ? t("dash.thisWeek") : t("dash.today")}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setWeekStart((w) => { const d = new Date(w); d.setUTCDate(w.getUTCDate() + 7); return d; })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {days[0].toLocaleDateString(locale, { day: "numeric", month: "short" })} – {days[6].toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="h-16 rounded-2xl bg-secondary/40 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((d) => {
              const dateStr = ymdDate(d);
              const s = shiftByDate.get(dateStr);
              const tpl = s ? pickTemplate(s.shift_templates) : null;
              const isToday = dateStr === ymdDate(new Date());
              return (
                <div
                  key={dateStr}
                  className={`rounded-2xl border p-3 flex items-center justify-between transition ${
                    isToday ? "ring-2 ring-accent/40 shadow-warm" : ""
                  } ${tpl ? shiftColor(tpl.name) : "bg-card text-card-foreground border-border"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[40px]">
                      <p className="text-[10px] uppercase font-mono font-medium opacity-70">
                        {d.toLocaleDateString(locale, { weekday: "short" }).slice(0, 3).toUpperCase()}
                      </p>
                      <p className={`text-lg font-semibold leading-none ${isToday ? "text-accent" : ""}`}>{d.getUTCDate()}</p>
                    </div>
                    <div>
                      {tpl ? (
                        <>
                          <p className="font-medium text-sm">{tpl.name}</p>
                          {(tpl.start_time || tpl.end_time) && (
                            <p className="text-xs opacity-70 flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {fmtTime(tpl.start_time ?? null)}{tpl.end_time ? ` – ${fmtTime(tpl.end_time)}` : ""}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("dash.dayOff")}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {rooms !== null && (() => {
        const toClean = rooms.filter((r) => r.checkout || r.checkin);
        return (
          <section className="space-y-2">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <LogOut className="h-4 w-4 text-accent" /> {t("dash.rooms")}
            </h2>
            {toClean.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dash.noRooms")}</p>
            ) : (
              <div className="space-y-1.5">
                {toClean.map((r, i) => (
                  <div key={i} className="rounded-xl border bg-card px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{r.room}</span>
                    <div className="flex items-center gap-2 text-xs">
                      {r.checkout && (
                        <span className="flex items-center gap-1 text-orange-600 font-medium">
                          <LogOut className="h-3 w-3" /> {t("dash.checkout")}
                        </span>
                      )}
                      {r.checkin && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <LogIn className="h-3 w-3" /> {t("dash.checkin")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      <div className="flex flex-col gap-3">
        <Link
          to="/app/guidebook"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-4 font-medium shadow-soft hover:opacity-90 transition"
        >
          <BookOpen className="h-5 w-5" /> {t("dash.viewGuides")}
        </Link>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-white py-4 font-medium shadow-soft hover:opacity-90 transition"
        >
          <MessageCircle className="h-5 w-5" /> {t("dash.whatsapp")}
        </a>
      </div>
    </div>
  );
}

// ── Admin / Staff dashboard ────────────────────────────────────────────────

type MatrixShift = {
  id: string;
  shift_date: string;
  volunteer_id: string | null;
  shift_template_id: string | null;
  volunteers: { id: string; name: string } | { id: string; name: string }[] | null;
  shift_templates: { id: string; name: string } | { id: string; name: string }[] | null;
};

type VolunteerRow = { id: string; name: string; role_type?: string | null };
type TemplateRow  = { id: string; name: string };

const TASK_ORDER = [
  "Breakfast", "Housekeeping", "Laundry", "Cottages",
  "Maintenance", "Deep Cleaning", "Special Task", "Family Dinners",
];

function pickName<T extends { name: string }>(v: T | T[] | null): string | null {
  if (!v) return null;
  const item = Array.isArray(v) ? v[0] : v;
  return item?.name ?? null;
}
function pickId<T extends { id: string }>(v: T | T[] | null): string | null {
  if (!v) return null;
  const item = Array.isArray(v) ? v[0] : v;
  return item?.id ?? null;
}

function addDaysUTC(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isManagerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r.includes("manager") || r === "admin" || r === "owner";
}

function AdminMatrix() {
  const { t, lang } = useI18n();
  const locale = LOCALE_MAP[lang] ?? "en-GB";
  const [weekStart, setWeekStart] = useState<string>(() => {
    const d = startOfWeekMondayUTC(new Date());
    return ymdDate(d);
  });
  const [shifts, setShifts]         = useState<MatrixShift[]>([]);
  const [volunteers, setVolunteers]  = useState<VolunteerRow[]>([]);
  const [templates, setTemplates]    = useState<TemplateRow[]>([]);
  const [loading, setLoading]        = useState(true);
  const [copying, setCopying]        = useState(false);
  const [assigning, setAssigning]    = useState<string | null>(null);
  const [volSearch, setVolSearch]    = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysUTC(weekStart, i)),
    [weekStart]
  );

  // Stable color map: sorted volunteer list index → VOL_PALETTE
  const volColorMap = useMemo(() => {
    const map = new Map<string, VolColor>();
    volunteers.forEach((v, i) => map.set(v.id, VOL_PALETTE[i % VOL_PALETTE.length]));
    return map;
  }, [volunteers]);

  // Volunteers eligible for field tasks (exclude managers)
  const fieldVolunteers = useMemo(
    () => volunteers.filter((v) => !isManagerRole(v.role_type)),
    [volunteers]
  );

  const loadData = useCallback(async (daysArr: string[]) => {
    setLoading(true);
    const [shiftRes, volRes, tplRes] = await Promise.all([
      hostackSupabase
        .from("shifts")
        .select("id, shift_date, volunteer_id, shift_template_id, volunteers(id, name), shift_templates(id, name)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", daysArr[0])
        .lte("shift_date", daysArr[6]),
      hostackSupabase
        .from("volunteers")
        .select("id, name, role_type")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("status", "active")
        .order("name"),
      hostackSupabase
        .from("shift_templates")
        .select("id, name")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .order("name"),
    ]);
    if (shiftRes.error) toast.error(shiftRes.error.message);
    if (volRes.error)   toast.error(volRes.error.message);
    if (tplRes.error)   toast.error(tplRes.error.message);
    setShifts((shiftRes.data as MatrixShift[]) ?? []);
    setVolunteers((volRes.data as VolunteerRow[]) ?? []);
    setTemplates((tplRes.data as TemplateRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(days); }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const taskNames = useMemo(() => {
    const fromData = [...new Set(shifts.map((s) => pickName(s.shift_templates)).filter(Boolean) as string[])];
    const ordered = TASK_ORDER.filter((n) => fromData.includes(n));
    const rest = fromData.filter((n) => !TASK_ORDER.includes(n)).sort();
    return [...ordered, ...rest];
  }, [shifts]);

  const cellShifts = (tplName: string, date: string) =>
    shifts.filter((s) => pickName(s.shift_templates) === tplName && s.shift_date === date);

  const removeShift = async (shiftId: string) => {
    const { error } = await hostackSupabase.from("shifts").delete().eq("id", shiftId);
    if (error) { toast.error(error.message); return; }
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  };

  const assignVolunteer = async (tplName: string, date: string, volId: string) => {
    const tpl = templates.find((t) => t.name === tplName);
    if (!tpl || !volId) return;
    const payload = {
      property_id: TORRIDONIA_PROPERTY_ID,
      shift_date: date,
      volunteer_id: volId,
      shift_template_id: tpl.id,
      status: "scheduled",
    };
    const { error } = await hostackSupabase.from("shifts").insert(payload);
    if (error) { toast.error(error.message); return; }
    await loadData(days);
  };

  const openAssign = useCallback((key: string) => {
    setAssigning(key);
    setVolSearch("");
    setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
          setAssigning(null);
          setVolSearch("");
          document.removeEventListener("mousedown", handler);
        }
      };
      document.addEventListener("mousedown", handler);
    }, 0);
  }, []);

  const assignedOnDay = useCallback((date: string): Set<string> => {
    const ids = new Set<string>();
    shifts.forEach((s) => { if (s.shift_date === date && s.volunteer_id) ids.add(s.volunteer_id); });
    return ids;
  }, [shifts]);

  const copyWeekToNext = async () => {
    setCopying(true);
    const nextStart = addDaysUTC(weekStart, 7);
    const nextEnd   = addDaysUTC(nextStart, 6);

    // Check for existing shifts in next week to avoid duplicates
    const { data: existing } = await hostackSupabase
      .from("shifts")
      .select("shift_date, volunteer_id, shift_template_id")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .gte("shift_date", nextStart)
      .lte("shift_date", nextEnd);

    const existingSet = new Set(
      (existing ?? []).map((s) => `${s.shift_date}__${s.volunteer_id}__${s.shift_template_id}`)
    );

    const toInsert = shifts
      .filter((s) => s.volunteer_id && s.shift_template_id)
      .map((s) => {
        const newDate = addDaysUTC(s.shift_date, 7);
        const key = `${newDate}__${s.volunteer_id}__${s.shift_template_id}`;
        if (existingSet.has(key)) return null;
        return {
          property_id: TORRIDONIA_PROPERTY_ID,
          shift_date: newDate,
          volunteer_id: s.volunteer_id,
          shift_template_id: s.shift_template_id,
          status: "scheduled",
        };
      })
      .filter(Boolean);

    if (toInsert.length === 0) {
      toast.info("Next week already has shifts or no shifts to copy.");
      setCopying(false);
      return;
    }

    const { error } = await hostackSupabase.from("shifts").insert(toInsert);
    if (error) { toast.error(error.message); setCopying(false); return; }
    toast.success(`${toInsert.length} shifts copied to next week.`);
    setCopying(false);
    setWeekStart(nextStart);
  };

  const prevWeek = () => setWeekStart(addDaysUTC(weekStart, -7));
  const nextWeek = () => setWeekStart(addDaysUTC(weekStart, 7));
  const thisWeek = () => setWeekStart(ymdDate(startOfWeekMondayUTC(new Date())));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("matrix.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("matrix.sub")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={copyWeekToNext}
            disabled={copying || loading || shifts.length === 0}
          >
            <Copy className="h-3.5 w-3.5" />
            {copying ? t("matrix.copying") : t("matrix.copyWeek")}
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={thisWeek}>
              {days[0]} – {days[6]}
            </Button>
            <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-secondary/30 animate-pulse" />
      ) : taskNames.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("matrix.noShifts")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b bg-secondary/30">
                <th className="text-left p-3 font-semibold w-32 sticky left-0 bg-secondary/30">&nbsp;</th>
                {days.map((d) => {
                  const today = d === ymdDate(new Date());
                  return (
                    <th key={d} className={`p-2 text-center font-semibold ${today ? "text-accent" : "text-muted-foreground"}`}>
                      <div>{new Date(d + "T00:00:00Z").toLocaleDateString(locale, { weekday: "short" })}</div>
                      <div className={`text-base font-display ${today ? "text-accent" : ""}`}>
                        {new Date(d + "T00:00:00Z").getUTCDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {taskNames.map((task) => (
                <tr key={task} className="border-b last:border-0 hover:bg-secondary/10">
                  <td className="p-3 font-medium text-foreground sticky left-0 bg-card border-r w-32">{task}</td>
                  {days.map((d) => {
                    const cellKey = `${task}__${d}`;
                    const cell = cellShifts(task, d);
                    const isAssigning = assigning === cellKey;
                    const busyIds = isAssigning ? assignedOnDay(d) : new Set<string>();
                    const filtered = fieldVolunteers.filter((v) => {
                      if (!volSearch) return true;
                      return v.name.toLowerCase().includes(volSearch.toLowerCase());
                    });
                    return (
                      <td key={d} className="p-2 align-top min-w-[120px] relative">
                        <div className="flex flex-wrap gap-1">
                          {cell.map((s) => {
                            const volId = s.volunteer_id ?? pickId(s.volunteers) ?? "";
                            const vc = volColorMap.get(volId) ?? VOL_PALETTE[0];
                            return (
                              <span
                                key={s.id}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${vc.chip}`}
                              >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${vc.dot}`} />
                                {pickName(s.volunteers) ?? "?"}
                                <button
                                  type="button"
                                  onClick={() => removeShift(s.id)}
                                  className="opacity-50 hover:opacity-100 ml-0.5"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => isAssigning ? (setAssigning(null), setVolSearch("")) : openAssign(cellKey)}
                            className={`inline-flex items-center justify-center rounded-full border border-dashed w-5 h-5 transition ${
                              isAssigning
                                ? "border-primary text-primary"
                                : "border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary"
                            }`}
                          >
                            {isAssigning ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          </button>
                        </div>

                        {isAssigning && (
                          <div
                            ref={pickerRef}
                            className="absolute z-50 top-8 left-0 bg-popover border rounded-xl shadow-xl w-56 overflow-hidden"
                            onKeyDown={(e) => { if (e.key === "Escape") { setAssigning(null); setVolSearch(""); } }}
                          >
                            <div className="px-2 pt-2 pb-1 border-b">
                              <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1">
                                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                                <input
                                  autoFocus
                                  className="text-xs bg-transparent outline-none w-full placeholder:text-muted-foreground"
                                  placeholder={t("matrix.selectVol")}
                                  value={volSearch}
                                  onChange={(e) => setVolSearch(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="max-h-52 overflow-y-auto py-1">
                              {filtered.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-3">No results</p>
                              ) : (
                                filtered.map((v) => {
                                  const busy = busyIds.has(v.id);
                                  const alreadyHere = cell.some((s) => s.volunteer_id === v.id);
                                  if (alreadyHere) return null;
                                  const vc = volColorMap.get(v.id) ?? VOL_PALETTE[0];
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      disabled={busy}
                                      onClick={() => assignVolunteer(task, d, v.id)}
                                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 transition ${
                                        busy
                                          ? "opacity-40 cursor-not-allowed"
                                          : "hover:bg-secondary/60 cursor-pointer"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${vc.dot}`} />
                                        <div className="min-w-0">
                                          <div className="font-medium truncate">{v.name}</div>
                                          {v.role_type && (
                                            <div className="text-[10px] text-muted-foreground">{v.role_type}</div>
                                          )}
                                        </div>
                                      </div>
                                      {busy && <span className="text-[10px] text-muted-foreground shrink-0">busy</span>}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Manager "Today" section ───────────────────────────────────────────────

function TodayRooms() {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<RoomEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setLoading(true);
    loadTodaysRooms(today)
      .then((r) => { setRooms(r); setLoading(false); })
      .catch(() => { setRooms(null); setLoading(false); });
  }, []);

  if (loading) return <div className="h-16 rounded-2xl bg-secondary/40 animate-pulse" />;
  if (!rooms || rooms.length === 0) return (
    <div className="rounded-2xl border border-dashed bg-secondary/30 p-6 text-center text-muted-foreground">
      <Calendar className="h-6 w-6 mx-auto mb-2" />
      <p className="text-sm">{t("dash.noToday")}</p>
    </div>
  );

  const checkins  = rooms.filter((r) => r.checkin);
  const checkouts = rooms.filter((r) => r.checkout && !r.checkin);

  return (
    <div className="space-y-4">
      {checkins.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
            <LogIn className="h-4 w-4" /> {t("dash.checkinsToday")}
          </h3>
          <div className="space-y-1.5">
            {checkins.map((r, i) => (
              <div key={i} className="rounded-xl border bg-emerald-50 px-4 py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-emerald-900">{r.guest || r.room}</p>
                  {r.guest && <p className="text-xs text-emerald-700 mt-0.5">{r.room}</p>}
                </div>
                {r.guests > 0 && (
                  <span className="text-xs text-emerald-600 font-medium">{r.guests} {t("dash.guests")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {checkouts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-orange-700">
            <LogOut className="h-4 w-4" /> {t("dash.checkoutsToday")}
          </h3>
          <div className="space-y-1.5">
            {checkouts.map((r, i) => (
              <div key={i} className="rounded-xl border bg-orange-50 px-4 py-2.5 text-sm">
                <p className="font-medium text-orange-900">{r.room}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { user, profile } = useAuth();
  const { t, lang } = useI18n();
  const locale = LOCALE_MAP[lang] ?? "en-GB";

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="font-display text-4xl font-semibold mt-1">
          {t("dash.hi")}, {profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || t("dash.friend")} 👋
        </h1>
      </header>

      <section>
        <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" /> {t("dash.today")}
        </h2>
        <TodayRooms />
      </section>

      <AdminMatrix />
    </div>
  );
}
