import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { TASK_TYPES, TASK_TYPE_LABELS, TASK_TYPE_DOT, type TaskType, startOfWeek, addDays, fmtDate } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/calendar")({ component: CalendarPage });

type Task = {
  id: string; title: string; type: TaskType; scheduled_date: string;
  start_time: string | null; end_time: string | null; location: string | null;
  assigned_to: string | null;
};

function CalendarPage() {
  const { t, lang } = useI18n();
  const localeMap: Record<string, string> = { en: "en-GB", pt: "pt-BR", es: "es-ES", de: "de-DE", gd: "gd-GB" };
  const locale = localeMap[lang] ?? "en-GB";
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").then(({ data }) => setVolunteers(data ?? []));
  }, []);

  useEffect(() => {
    const start = fmtDate(weekStart);
    const end = fmtDate(addDays(weekStart, 7));
    supabase
      .from("tasks")
      .select("id, title, type, scheduled_date, start_time, end_time, location, assigned_to, profiles!tasks_assigned_to_fkey(full_name)")
      .gte("scheduled_date", start).lt("scheduled_date", end)
      .order("start_time")
      .then(({ data }) => setTasks((data as unknown as Task[]) ?? []));
  }, [weekStart]);

  const filtered = tasks.filter((t) =>
    (filterType === "all" || t.type === filterType) &&
    (filterUser === "all" || t.assigned_to === filterUser)
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t("cal.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("cal.sub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-3">{weekStart.toLocaleDateString(locale, { day: "numeric", month: "short" })} – {addDays(weekStart, 6).toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("cal.allTypes")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("cal.allTypes")}</SelectItem>
            {TASK_TYPES.map((tt) => <SelectItem key={tt} value={tt}>{TASK_TYPE_LABELS[tt]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-56"><SelectValue placeholder={t("cal.allVols")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("cal.allVols")}</SelectItem>
            {volunteers.map((v) => <SelectItem key={v.id} value={v.id}>{v.full_name || "—"}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-7 gap-3">
        {days.map((d) => {
          const dayTasks = filtered.filter((t) => t.scheduled_date === fmtDate(d));
          return (
            <div key={d.toISOString()} className="rounded-xl border bg-card p-3 min-h-[140px]">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {d.toLocaleDateString(locale, { weekday: "short" })}
              </div>
              <div className="text-2xl font-display">{d.getDate()}</div>
              <div className="mt-3 space-y-2">
                {dayTasks.length === 0 && <p className="text-xs text-muted-foreground/60">—</p>}
                {dayTasks.map((t) => (
                  <div key={t.id} className="rounded-lg bg-secondary/60 p-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${TASK_TYPE_DOT[t.type]}`} />
                      <span className="font-medium truncate">{t.title}</span>
                    </div>
                    {t.start_time && <div className="text-muted-foreground mt-0.5">{t.start_time.slice(0, 5)}</div>}
                    {t.profiles?.full_name && <div className="text-muted-foreground truncate">{t.profiles.full_name}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-4 border-t">
        {TASK_TYPES.map((t) => (
          <Badge key={t} variant="outline" className="gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TASK_TYPE_DOT[t]}`} /> {TASK_TYPE_LABELS[t]}
          </Badge>
        ))}
      </div>
    </div>
  );
}
