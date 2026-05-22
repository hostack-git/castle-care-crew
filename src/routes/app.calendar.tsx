import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { useI18n, LOCALE_MAP } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, User } from "lucide-react";

export const Route = createFileRoute("/app/calendar")({ component: CalendarPage });

type Volunteer = { name: string | null };
type ShiftTemplate = { name: string | null; start_time: string | null; end_time: string | null };
type WeekShift = {
  id: string;
  shift_date: string;
  volunteer_id: string | null;
  volunteers: Volunteer | Volunteer[] | null;
  shift_templates: ShiftTemplate | ShiftTemplate[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function startOfWeekMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day + 6) % 7);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function CalendarPage() {
  const { t, lang } = useI18n();
  const locale = LOCALE_MAP[lang] ?? "en-GB";

  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [shifts, setShifts] = useState<WeekShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = fmtDate(weekStart);
    const end = fmtDate(addDays(weekStart, 6));
    setLoading(true);
    hostackSupabase
      .from("shifts")
      .select("id, shift_date, volunteer_id, volunteers(name), shift_templates(name, start_time, end_time)")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .gte("shift_date", start)
      .lte("shift_date", end)
      .order("shift_date")
      .then(({ data }) => {
        setShifts((data as WeekShift[]) ?? []);
        setLoading(false);
      });
  }, [weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const fmtTime = (v: string | null) => (v ? v.slice(0, 5) : "");
  const isToday = (d: Date) => fmtDate(d) === fmtDate(new Date());

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t("cal.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("cal.sub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-3">
            {weekStart.toLocaleDateString(locale, { day: "numeric", month: "short" })} –{" "}
            {addDays(weekStart, 6).toLocaleDateString(locale, { day: "numeric", month: "short" })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            {t("cal.today")}
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-3 min-w-[140px] flex-1 min-h-[160px] animate-pulse bg-secondary/40" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {days.map((d) => {
            const key = fmtDate(d);
            const dayShifts = shifts.filter((s) => s.shift_date === key);
            const today = isToday(d);
            return (
              <div
                key={key}
                className={`rounded-xl border bg-card p-3 min-w-[140px] flex-1 min-h-[160px] ${today ? "ring-2 ring-accent/40" : ""}`}
              >
                <div className={`text-xs font-semibold uppercase tracking-wide ${today ? "text-accent" : "text-muted-foreground"}`}>
                  {d.toLocaleDateString(locale, { weekday: "short" })}
                </div>
                <div className={`text-2xl font-display font-semibold ${today ? "text-accent" : ""}`}>{d.getDate()}</div>
                <div className="mt-3 space-y-2">
                  {dayShifts.length === 0 && <p className="text-xs text-muted-foreground/50">—</p>}
                  {dayShifts.map((s) => {
                    const tpl = pickOne<ShiftTemplate>(s.shift_templates);
                    const vol = pickOne<Volunteer>(s.volunteers);
                    return (
                      <div key={s.id} className="rounded-lg bg-secondary/60 p-2 text-xs space-y-0.5">
                        {vol?.name && (
                          <div className="flex items-center gap-1 font-semibold text-foreground truncate">
                            <User className="h-3 w-3 shrink-0 text-primary" />
                            <span className="truncate">{vol.name}</span>
                          </div>
                        )}
                        <div className="text-muted-foreground truncate">{tpl?.name ?? "—"}</div>
                        {(tpl?.start_time || tpl?.end_time) && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {fmtTime(tpl?.start_time ?? null)}
                            {tpl?.end_time ? `–${fmtTime(tpl.end_time)}` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
