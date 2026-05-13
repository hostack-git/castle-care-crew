import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, User } from "lucide-react";

export const Route = createFileRoute("/app/calendar")({ component: CalendarPage });

type Staff = { name: string | null };
type ShiftTemplate = { name: string | null; start_time: string | null; end_time: string | null };
type WeekShift = {
  id: string;
  shift_date: string;
  staff_id: string | null;
  staff: Staff | Staff[] | null;
  shift_templates: ShiftTemplate | ShiftTemplate[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function startOfWeekMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 Sun ... 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  date.setDate(date.getDate() - diff);
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
  const localeMap: Record<string, string> = { en: "en-GB", pt: "pt-BR", es: "es-ES", de: "de-DE", gd: "gd-GB" };
  const locale = localeMap[lang] ?? "en-GB";

  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [shifts, setShifts] = useState<WeekShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = fmtDate(weekStart);
    const end = fmtDate(addDays(weekStart, 6));
    setLoading(true);
    hostackSupabase
      .from("shifts")
      .select("id, shift_date, staff_id, staff(name), shift_templates(name, start_time, end_time)")
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
            Today
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="grid md:grid-cols-7 gap-3">
          {days.map((d) => {
            const key = fmtDate(d);
            const dayShifts = shifts.filter((s) => s.shift_date === key);
            return (
              <div key={key} className="rounded-xl border bg-card p-3 min-h-[160px]">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {d.toLocaleDateString(locale, { weekday: "short" })}
                </div>
                <div className="text-2xl font-display">{d.getDate()}</div>
                <div className="mt-3 space-y-2">
                  {dayShifts.length === 0 && <p className="text-xs text-muted-foreground/60">—</p>}
                  {dayShifts.map((s) => {
                    const tpl = pickOne<ShiftTemplate>(s.shift_templates);
                    const staff = pickOne<Staff>(s.staff);
                    return (
                      <div key={s.id} className="rounded-lg bg-secondary/60 p-2 text-xs space-y-0.5">
                        <div className="font-medium truncate">{tpl?.name ?? "Shift"}</div>
                        {(tpl?.start_time || tpl?.end_time) && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {fmtTime(tpl?.start_time ?? null)}
                            {tpl?.end_time ? `–${fmtTime(tpl.end_time)}` : ""}
                          </div>
                        )}
                        {staff?.name && (
                          <div className="flex items-center gap-1 text-muted-foreground truncate">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">{staff.name}</span>
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
