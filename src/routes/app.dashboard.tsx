import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Calendar, Clock, CheckCircle2, Circle, BookOpen } from "lucide-react";
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
  const { isVolunteer } = useAuth();
  return isVolunteer ? <VolunteerDashboard /> : <Dashboard />;
}

type VolShift = {
  id: string;
  shift_date: string;
  shift_templates: ShiftTemplate | ShiftTemplate[] | null;
};

function VolunteerDashboard() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<VolShift[]>([]);

  const localeMap: Record<string, string> = { en: "en-GB", pt: "pt-BR", es: "es-ES", de: "de-DE", gd: "gd-GB" };
  const locale = localeMap[lang] ?? "en-GB";
  const name = (user?.user_metadata as { full_name?: string } | undefined)?.full_name || "Voluntario";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const dow = (now.getDay() + 6) % 7; // Mon=0
      const start = new Date(now); start.setDate(now.getDate() - dow);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      const iso = (d: Date) => d.toISOString().split("T")[0];
      const { data } = await hostackSupabase
        .from("shifts")
        .select("id, shift_date, shift_templates(name, start_time, end_time)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", iso(start))
        .lte("shift_date", iso(end))
        .order("shift_date", { ascending: true });
      if (!cancelled) {
        setShifts((data as VolShift[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fmtTime = (v: string | null) => (v ? v.slice(0, 5) : "");

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="font-display text-4xl font-semibold mt-1">Hola, {name}! 👋</h1>
      </header>

      <section>
        <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" /> Turnos de esta semana
        </h2>
        {loading ? (
          <div className="h-24 rounded-2xl bg-secondary/40 animate-pulse" />
        ) : shifts.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-secondary/30 p-8 text-center text-muted-foreground text-sm">
            Aún no tienes turnos asignados esta semana. Consulta con tu manager.
          </div>
        ) : (
          <div className="space-y-2">
            {shifts.map((s) => {
              const tpl = pickTemplate(s.shift_templates);
              const d = new Date(s.shift_date);
              return (
                <div key={s.id} className="rounded-2xl border bg-card p-4 shadow-soft flex items-center justify-between">
                  <div>
                    <p className="font-medium">{d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })}</p>
                    <p className="text-sm text-muted-foreground">{tpl?.name ?? "Shift"}</p>
                  </div>
                  {(tpl?.start_time || tpl?.end_time) && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtTime(tpl?.start_time ?? null)}{tpl?.end_time ? ` – ${fmtTime(tpl.end_time)}` : ""}
                    </span>
                  )}
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
      // Resolve staff id (prefer profile.id, fallback to live lookup)
      let staffId = profile?.id ?? null;
      if (!staffId) {
        const { data: staffRow } = await hostackSupabase
          .from("staff")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        staffId = (staffRow as { id: string } | null)?.id ?? null;
      }
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
          {t("dash.hi")}, {profile?.full_name?.split(" ")[0] || t("dash.friend")} 👋
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
