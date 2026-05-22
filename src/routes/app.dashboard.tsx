import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, LOCALE_MAP } from "@/lib/i18n";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Calendar, Clock, CheckCircle2, Circle, BookOpen, ChevronLeft, ChevronRight, MessageCircle, Plus, X, LogIn, LogOut } from "lucide-react";
import { startOfWeekMondayUTC } from "@/lib/rota-utils";
import { loadTodaysRooms, roomsToClean, type RoomEntry } from "@/lib/amenitiz-parser";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dashboard")({ component: DashboardRoute });

const WHATSAPP_URL = "https://chat.whatsapp.com/DvsSz15BQp98Zl8mQRIMLp";

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
  { match: "breakfast",   cls: "bg-orange-100 text-orange-900 border-orange-200" },
  { match: "housekeep",  cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  { match: "laundry",    cls: "bg-blue-100 text-blue-900 border-blue-200" },
  { match: "cottage",    cls: "bg-teal-100 text-teal-900 border-teal-200" },
  { match: "maintenance",cls: "bg-amber-100 text-amber-900 border-amber-200" },
  { match: "deep",       cls: "bg-purple-100 text-purple-900 border-purple-200" },
  { match: "special",    cls: "bg-red-100 text-red-900 border-red-200" },
  { match: "family",     cls: "bg-pink-100 text-pink-900 border-pink-200" },
  { match: "dinner",     cls: "bg-pink-100 text-pink-900 border-pink-200" },
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
        const toClean = roomsToClean(rooms);
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

type VolunteerRow = { id: string; name: string };
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

function AdminMatrix() {
  const { t, lang } = useI18n();
  const locale = LOCALE_MAP[lang] ?? "en-GB";
  const [weekStart, setWeekStart] = useState<string>(() => {
    const d = startOfWeekMondayUTC(new Date());
    return ymdDate(d);
  });
  const [shifts, setShifts]       = useState<MatrixShift[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);
  const [templates, setTemplates]  = useState<TemplateRow[]>([]);
  const [loading, setLoading]      = useState(true);
  const [assigning, setAssigning]  = useState<string | null>(null); // "templateId__date"
  const assignRef = useRef<HTMLSelectElement>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysUTC(weekStart, i)),
    [weekStart]
  );

  const loadData = async () => {
    setLoading(true);
    const [shiftRes, volRes, tplRes] = await Promise.all([
      hostackSupabase
        .from("shifts")
        .select("id, shift_date, volunteer_id, shift_template_id, volunteers(id, name), shift_templates(id, name)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", days[0])
        .lte("shift_date", days[6]),
      hostackSupabase
        .from("volunteers")
        .select("id, name")
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
  };

  useEffect(() => { loadData(); }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const taskNames = useMemo(() => {
    const fromData = [...new Set(shifts.map((s) => pickName(s.shift_templates)).filter(Boolean) as string[])];
    const ordered = TASK_ORDER.filter((n) => fromData.includes(n));
    const rest = fromData.filter((n) => !TASK_ORDER.includes(n)).sort();
    return [...ordered, ...rest];
  }, [shifts]);

  const cellShifts = (tplName: string, date: string) =>
    shifts.filter(
      (s) => pickName(s.shift_templates) === tplName && s.shift_date === date
    );

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
    setAssigning(null);
    await loadData();
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
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={thisWeek}>
            {days[0]} – {days[6]}
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
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
                    return (
                      <td key={d} className="p-2 align-top min-w-[110px]">
                        <div className="flex flex-wrap gap-1">
                          {cell.map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium"
                            >
                              {pickName(s.volunteers) ?? "?"}
                              <button
                                type="button"
                                onClick={() => removeShift(s.id)}
                                className="opacity-50 hover:opacity-100 ml-0.5"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                          {isAssigning ? (
                            <span className="flex items-center gap-1">
                              <select
                                ref={assignRef}
                                className="text-[11px] rounded border px-1 py-0.5 bg-background"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) assignVolunteer(task, d, e.target.value);
                                }}
                              >
                                <option value="" disabled>{t("matrix.selectVol")}</option>
                                {volunteers.map((v) => (
                                  <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                              </select>
                              <button type="button" onClick={() => setAssigning(null)} className="opacity-50 hover:opacity-100">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAssigning(cellKey)}
                              className="inline-flex items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary w-5 h-5 transition"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
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

function Dashboard() {
  const { user, profile } = useAuth();
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const locale = LOCALE_MAP[lang] ?? "en-GB";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const staffId = profile?.id ?? null;
      if (!staffId) {
        if (!cancelled) { setShift(null); setTasks([]); setLoading(false); }
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const { data: shiftRow } = await hostackSupabase
        .from("shifts")
        .select("id, shift_date, shift_templates(name, start_time, end_time)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("staff_id", staffId)
        .eq("shift_date", today)
        .maybeSingle();

      if (cancelled) return;
      const s = (shiftRow as Shift | null) ?? null;
      setShift(s);

      if (s) {
        const { data: taskRows } = await hostackSupabase
          .from("checklist_tasks")
          .select("id, title, status, due_time, notes")
          .eq("shift_id", s.id)
          .order("due_time", { ascending: true });
        if (!cancelled) setTasks((taskRows as Task[]) ?? []);
      } else {
        setTasks([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, profile?.id]);

  const toggleTask = async (task: Task) => {
    const next = task.status === "completed" ? "pending" : "completed";
    const prev = tasks;
    setTasks((cur) => cur.map((x) => (x.id === task.id ? { ...x, status: next } : x)));
    const { error } = await hostackSupabase
      .from("checklist_tasks")
      .update({ status: next })
      .eq("id", task.id);
    if (error) { setTasks(prev); toast.error(error.message); }
  };

  const tpl = pickTemplate(shift?.shift_templates ?? null);
  const fmtTime = (v: string | null) => (v ? v.slice(0, 5) : "");

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

        {loading ? (
          <div className="h-24 rounded-2xl bg-secondary/40 animate-pulse" />
        ) : !shift ? (
          <div className="rounded-2xl border border-dashed bg-secondary/30 p-8 text-center text-muted-foreground">
            <Calendar className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">{t("dash.noToday")}</p>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-display text-2xl font-semibold">{tpl?.name ?? "Shift"}</h3>
                {(tpl?.start_time || tpl?.end_time) && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {fmtTime(tpl?.start_time ?? null)}
                    {tpl?.end_time ? ` – ${fmtTime(tpl.end_time)}` : ""}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {tasks.filter((x) => x.status === "completed").length} / {tasks.length} done
              </span>
            </div>

            <div className="mt-5 space-y-2">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("dash.noToday")}</p>
              ) : (
                tasks.map((task) => {
                  const done = task.status === "completed";
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task)}
                      className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition hover:bg-secondary/50 ${done ? "bg-secondary/30" : "bg-card"}`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          {task.due_time && <span>{fmtTime(task.due_time)}</span>}
                          {task.notes && <span className="truncate">{task.notes}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>

      <AdminMatrix />
    </div>
  );
}
