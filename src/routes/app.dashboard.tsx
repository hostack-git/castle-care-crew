import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Calendar, Clock, CheckCircle2, Circle, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { startOfWeekMondayUTC } from "@/lib/rota-utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dashboard")({ component: DashboardRoute });

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
  { match: "housekeep",    cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  { match: "laundry",      cls: "bg-blue-100 text-blue-900 border-blue-200" },
  { match: "cottage",      cls: "bg-teal-100 text-teal-900 border-teal-200" },
  { match: "maintenance",  cls: "bg-amber-100 text-amber-900 border-amber-200" },
  { match: "deep",         cls: "bg-purple-100 text-purple-900 border-purple-200" },
  { match: "special",      cls: "bg-red-100 text-red-900 border-red-200" },
  { match: "family",       cls: "bg-pink-100 text-pink-900 border-pink-200" },
  { match: "dinner",       cls: "bg-pink-100 text-pink-900 border-pink-200" },
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

const DAY_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function VolunteerDashboard() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<VolShift[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMondayUTC(new Date()));
  const [volunteerId, setVolunteerId] = useState<string | null>(null);

  const localeMap: Record<string, string> = { en: "en-GB", pt: "pt-BR", es: "es-ES", de: "de-DE", gd: "gd-GB" };
  const locale = localeMap[lang] ?? "en-GB";
  const name =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email?.split("@")[0] ||
    "Voluntario";

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setUTCDate(weekStart.getUTCDate() + i); return d; }),
    [weekStart]
  );
  const startStr = ymdDate(days[0]);
  const endStr = ymdDate(days[6]);

  // Resolve volunteer id once
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

  // Load shifts for displayed week
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
        <h1 className="font-display text-4xl font-semibold mt-1">Hola, {name}! 👋</h1>
      </header>

      <section className="space-y-3">
        {/* Week navigation */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" /> Mis turnos
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setWeekStart((w) => { const d = new Date(w); d.setUTCDate(w.getUTCDate() - 7); return d; })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs px-2"
              onClick={() => setWeekStart(startOfWeekMondayUTC(new Date()))}>
              {isCurrentWeek ? "Esta semana" : "Hoy"}
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
            {days.map((d, i) => {
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
                    <div className="text-center min-w-[36px]">
                      <p className="text-[10px] uppercase font-mono font-medium opacity-70">{DAY_ES[i]}</p>
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
                        <p className="text-sm text-muted-foreground">Día libre 🌿</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Link
        to="/app/guidebook"
        className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-4 font-medium shadow-soft hover:opacity-90 transition"
      >
        <BookOpen className="h-5 w-5" /> Ver guías de trabajo
      </Link>
    </div>
  );
}

function Dashboard() {
  const { user, profile } = useAuth();
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const localeMap: Record<string, string> = { en: "en-GB", pt: "pt-BR", es: "es-ES", de: "de-DE", gd: "gd-GB" };
  const locale = localeMap[lang] ?? "en-GB";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const staffId = profile?.id ?? null;
      if (!staffId) {
        if (!cancelled) {
          setShift(null);
          setTasks([]);
          setLoading(false);
        }
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
    return () => {
      cancelled = true;
    };
  }, [user, profile?.id]);

  const toggleTask = async (task: Task) => {
    const next = task.status === "completed" ? "pending" : "completed";
    const prev = tasks;
    setTasks((cur) => cur.map((x) => (x.id === task.id ? { ...x, status: next } : x)));
    const { error } = await hostackSupabase
      .from("checklist_tasks")
      .update({ status: next })
      .eq("id", task.id);
    if (error) {
      setTasks(prev);
      toast.error(error.message);
    }
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
          <Clock className="h-4 w-4 text-accent" /> Today's shift
        </h2>

        {loading ? (
          <div className="h-24 rounded-2xl bg-secondary/40 animate-pulse" />
        ) : !shift ? (
          <div className="rounded-2xl border border-dashed bg-secondary/30 p-8 text-center text-muted-foreground">
            <Calendar className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">Sin turno asignado hoy</p>
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
                <p className="text-sm text-muted-foreground">No tasks for this shift.</p>
              ) : (
                tasks.map((task) => {
                  const done = task.status === "completed";
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task)}
                      className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition hover:bg-secondary/50 ${
                        done ? "bg-secondary/30" : "bg-card"
                      }`}
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
    </div>
  );
}
