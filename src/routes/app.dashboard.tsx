import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { TASK_TYPE_LABELS, TASK_TYPE_DOT, type TaskType, startOfWeek, addDays, fmtDate } from "@/lib/constants";
import { Calendar, Clock, MapPin, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

type Task = {
  id: string;
  title: string;
  type: TaskType;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
};

function Dashboard() {
  const { user, profile } = useAuth();
  const { t, lang } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const today = startOfWeek(new Date());
    const end = addDays(today, 7);
    Promise.all([
      supabase
        .from("tasks")
        .select("id, title, type, scheduled_date, start_time, end_time, location, status")
        .eq("assigned_to", user.id)
        .gte("scheduled_date", fmtDate(today))
        .lt("scheduled_date", fmtDate(end))
        .order("scheduled_date")
        .order("start_time"),
      supabase
        .from("announcements")
        .select("id, title, content, priority, created_at")
        .order("created_at", { ascending: false })
        .limit(3),
    ]).then(([t, a]) => {
      setTasks((t.data as Task[]) ?? []);
      setAnns((a.data as Announcement[]) ?? []);
      setLoading(false);
    });
  }, [user]);

  const today = fmtDate(new Date());
  const todayTasks = tasks.filter((t) => t.scheduled_date === today);
  const upcoming = tasks.filter((t) => t.scheduled_date > today);
  const localeMap: Record<string, string> = { en: "en-GB", pt: "pt-BR", es: "es-ES", de: "de-DE", gd: "gd-GB" };
  const locale = localeMap[lang] ?? "en-GB";

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="font-display text-4xl font-semibold mt-1">
          {t("dash.hi")}, {profile?.full_name?.split(" ")[0] || t("dash.friend")} 👋
        </h1>
        <p className="text-muted-foreground mt-2">{t("dash.weekIntro")}</p>
      </header>

      {/* Today */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" /> {t("dash.today")}
        </h2>
        {loading ? (
          <SkeletonList />
        ) : todayTasks.length === 0 ? (
          <EmptyCard icon={<Calendar className="h-5 w-5" />} text={t("dash.noToday")} />
        ) : (
          <div className="space-y-3">
            {todayTasks.map((t) => <TaskCard key={t.id} task={t} locale={locale} />)}
          </div>
        )}
      </section>

      {/* This week */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" /> {t("dash.upcoming")}
          </h2>
          <Link to="/app/calendar" className="text-sm text-accent hover:underline">{t("dash.fullCal")}</Link>
        </div>
        {loading ? (
          <SkeletonList />
        ) : upcoming.length === 0 ? (
          <EmptyCard icon={<Calendar className="h-5 w-5" />} text={t("dash.noUpcoming")} />
        ) : (
          <div className="space-y-3">{upcoming.map((t) => <TaskCard key={t.id} task={t} locale={locale} />)}</div>
        )}
      </section>

      {/* Announcements */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-accent" /> {t("dash.notices")}
          </h2>
          <Link to="/app/announcements" className="text-sm text-accent hover:underline">{t("dash.allNotices")}</Link>
        </div>
        {anns.length === 0 ? (
          <EmptyCard icon={<Megaphone className="h-5 w-5" />} text={t("dash.noNotices")} />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {anns.map((a) => (
              <article key={a.id} className="rounded-2xl border bg-card p-5 shadow-soft">
                <div className="flex items-center gap-2 mb-2">
                  {a.priority === "high" && <Badge className="bg-accent text-accent-foreground">{t("dash.important")}</Badge>}
                  <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString(locale)}</p>
                </div>
                <h3 className="font-display text-lg font-semibold">{a.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{a.content}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TaskCard({ task, locale }: { task: Task; locale: string }) {
  const dot = TASK_TYPE_DOT[task.type];
  return (
    <Link
      to="/app/tasks/$taskId"
      params={{ taskId: task.id }}
      className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-soft hover:shadow-warm transition"
    >
      <span className={`h-10 w-1.5 rounded-full ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium truncate">{task.title}</h3>
          <Badge variant="secondary" className="text-[10px]">{TASK_TYPE_LABELS[task.type]}</Badge>
          {task.status === "completed" && <Badge className="text-[10px] bg-accent text-accent-foreground">✓</Badge>}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {task.start_time && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{task.start_time.slice(0, 5)}{task.end_time ? ` – ${task.end_time.slice(0, 5)}` : ""}</span>
          )}
          {task.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{task.location}</span>}
          <span>{new Date(task.scheduled_date).toLocaleDateString(locale, { weekday: "short", day: "numeric" })}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-secondary/30 p-8 text-center text-muted-foreground">
      <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => <div key={i} className="h-16 rounded-xl bg-secondary/40 animate-pulse" />)}
    </div>
  );
}
