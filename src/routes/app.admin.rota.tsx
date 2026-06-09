import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Save, ArrowLeft, Download, AlertTriangle, X } from "lucide-react";
import { importRotaFromSheets, tabNameForDate, startOfWeekMondayUTC } from "@/lib/rota-utils";
import { toast } from "sonner";
import { AmenitizUpload } from "@/components/AmenitizUpload";

export const Route = createFileRoute("/app/admin/rota")({ component: RotaBuilderPage });

type Volunteer = { id: string; name: string | null; role_type: string | null };
type Template = { id: string; name: string; start_time: string | null; end_time: string | null };
type Shift = {
  id?: string;
  shift_date: string;
  volunteer_id?: string | null;
  staff_id?: string | null;
  shift_template_id: string | null;
};

const OFF_KEY = "__off__";

const TYPE_COLORS: { match: string; cls: string }[] = [
  { match: "breakfast", cls: "bg-orange-100 text-orange-900 border-orange-200" },
  { match: "housekeep", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  { match: "laundry", cls: "bg-blue-100 text-blue-900 border-blue-200" },
  { match: "cottage", cls: "bg-teal-100 text-teal-900 border-teal-200" },
  { match: "maintenance", cls: "bg-amber-200 text-amber-900 border-amber-300" },
  { match: "deep", cls: "bg-purple-100 text-purple-900 border-purple-200" },
  { match: "special", cls: "bg-red-100 text-red-900 border-red-200" },
  { match: "family", cls: "bg-pink-100 text-pink-900 border-pink-200" },
  { match: "dinner", cls: "bg-pink-100 text-pink-900 border-pink-200" },
];
const OFF_CLS = "bg-muted text-muted-foreground border-border";
const EMPTY_CLS = "bg-muted/30 text-muted-foreground/60 border-dashed border-border";

function colorFor(name: string | null | undefined) {
  if (!name) return EMPTY_CLS;
  const n = name.toLowerCase();
  if (n === "off") return OFF_CLS;
  for (const t of TYPE_COLORS) if (n.includes(t.match)) return t.cls;
  return "bg-secondary text-secondary-foreground border-border";
}

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const diff = (dow + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function RotaBuilderPage() {
  const { isAdmin, loading } = useAuth();
  const { t } = useI18n();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [grid, setGrid] = useState<Record<string, Record<string, string | null>>>({});
  const [originalGrid, setOriginalGrid] = useState<Record<string, Record<string, string | null>>>({});
  const [shiftIds, setShiftIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const startStr = ymd(days[0]);
  const endStr = ymd(days[6]);

  useEffect(() => {
    let cancel = false;
    setLoadingData(true);
    (async () => {
      const [{ data: vols }, { data: tpls }, { data: shifts }] = await Promise.all([
        hostackSupabase
          .from("volunteers")
          .select("id, name, role_type")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .eq("status", "active")
          .order("name", { ascending: true }),
        hostackSupabase
          .from("shift_templates")
          .select("id, name, start_time, end_time")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .order("name", { ascending: true }),
        hostackSupabase
          .from("shifts")
          .select("id, shift_date, volunteer_id, shift_template_id")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .gte("shift_date", startStr)
          .lte("shift_date", endStr),
      ]);
      if (cancel) return;

      const volList = (vols as Volunteer[]) ?? [];
      const tplList = (tpls as Template[]) ?? [];
      const shiftList = (shifts as Shift[]) ?? [];

      const g: Record<string, Record<string, string | null>> = {};
      const ids: Record<string, string> = {};
      for (const v of volList) g[v.id] = {};
      for (const s of shiftList) {
        const volunteerId = s.volunteer_id;
        if (!volunteerId) continue;
        if (!g[volunteerId]) g[volunteerId] = {};
        g[volunteerId][s.shift_date] = s.shift_template_id ?? OFF_KEY;
        if (s.id) ids[`${volunteerId}_${s.shift_date}`] = s.id;
      }

      setVolunteers(volList);
      setTemplates(tplList);
      setGrid(g);
      setOriginalGrid(JSON.parse(JSON.stringify(g)));
      setShiftIds(ids);
      setLoadingData(false);
    })().catch((e) => {
      if (!cancel) {
        toast.error(e instanceof Error ? e.message : t("rota.errorLoad"));
        setLoadingData(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, [startStr, endStr, reloadTick]);

  const setCell = (vid: string, date: string, value: string | null) => {
    setGrid((prev) => ({ ...prev, [vid]: { ...(prev[vid] ?? {}), [date]: value } }));
  };

  const tplById = useMemo(() => {
    const m: Record<string, Template> = {};
    for (const t of templates) m[t.id] = t;
    return m;
  }, [templates]);

  const onImport = async () => {
    setImporting(true);
    setImportErrors([]);
    setImportSummary(null);
    try {
      const monCurrent = startOfWeekMondayUTC(new Date());
      const monNext = new Date(monCurrent);
      monNext.setUTCDate(monCurrent.getUTCDate() + 7);
      const tabs = [tabNameForDate(monCurrent), tabNameForDate(monNext)];
      const result = await importRotaFromSheets(tabs);
      setImportErrors(result.errors);
      setImportSummary(`${result.inserted} inserted · ${result.updated} updated · ${result.skipped} skipped`);
      if (result.errors.length > 0) {
        toast.warning(`Import done with ${result.errors.length} warning(s). See details below.`);
      } else {
        toast.success(t("rota.importOk").replace("{n}", String(result.inserted)).replace("{u}", String(result.updated)));
      }
      setReloadTick((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rota.errorImport"));
    } finally {
      setImporting(false);
    }
  };

  const onSave = async () => {
    setBusy(true);
    try {
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
      const toDelete: string[] = [];

      for (const v of volunteers) {
        for (const d of days) {
          const date = ymd(d);
          const next = grid[v.id]?.[date] ?? null;
          const prev = originalGrid[v.id]?.[date] ?? null;
          if (next === prev) continue;
          const existingId = shiftIds[`${v.id}_${date}`];
          if (next === null) {
            if (existingId) toDelete.push(existingId);
            continue;
          }
          const isOff = next === OFF_KEY;
          const tpl = isOff ? null : tplById[next];
          const payload = {
            property_id: TORRIDONIA_PROPERTY_ID,
            shift_date: date,
            volunteer_id: v.id,
            shift_template_id: isOff ? null : next,
            start_time: isOff ? "00:00" : (tpl?.start_time ?? "00:00"),
            end_time: isOff ? "00:00" : (tpl?.end_time ?? "00:00"),
            status: "scheduled",
          };
          if (existingId) {
            toUpdate.push({ id: existingId, data: payload });
          } else {
            toInsert.push(payload);
          }
        }
      }

      // Execute writes sequentially to respect RLS and avoid race conditions
      if (toDelete.length > 0) {
        await hostackSupabase.from("shifts").delete().in("id", toDelete);
      }
      for (const { id, data } of toUpdate) {
        await hostackSupabase.from("shifts").update(data).eq("id", id);
      }
      if (toInsert.length > 0) {
        await hostackSupabase.from("shifts").insert(toInsert);
      }

      toast.success(t("rota.saveOk").replace("{n}", String(toInsert.length + toUpdate.length)).replace("{d}", String(toDelete.length)));
      setOriginalGrid(JSON.parse(JSON.stringify(grid)));
      setReloadTick((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rota.errorSave"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <p className="text-sm">{t("rota.adminOnly")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/admin">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Admin
            </Button>
          </Link>
          <h1 className="font-display text-2xl font-semibold">Rota Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> {t("rota.prevWeek")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            {t("cal.today")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))} className="gap-1">
            {t("rota.nextWeek")} <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-2">
            {startStr} → {endStr}
          </span>
          <Button onClick={onImport} disabled={importing} variant="outline" className="gap-2 ml-2">
            <Download className="h-4 w-4" />
            {importing ? t("rota.importing") : "Import Sheets"}
          </Button>
          <Button onClick={onSave} disabled={busy} className="gap-2">
            <Save className="h-4 w-4" />
            {busy ? t("rota.saving") : t("rota.saveWeek")}
          </Button>
        </div>
      </div>

      {importSummary && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{importSummary}</p>
          {importErrors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {importErrors.length} name(s) not matched — these volunteers were skipped:
              </p>
              {importErrors.map((e, i) => (
                <p key={i} className="text-xs text-amber-600 pl-5">{e}</p>
              ))}
              <p className="text-xs text-muted-foreground pl-5 pt-1">
                Fix: make sure the volunteer name in the Rota Sheet exactly matches the name registered in the Volunteers list (case-insensitive).
              </p>
            </div>
          )}
          <button type="button" onClick={() => { setImportSummary(null); setImportErrors([]); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="h-3 w-3" /> Dismiss
          </button>
        </div>
      )}

      {loadingData ? (
        <p className="text-sm text-muted-foreground">{t("rota.loading")}</p>
      ) : volunteers.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("rota.noVolunteers")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-3 py-2 sticky left-0 bg-muted/40 z-10 min-w-[200px] border-b border-r">
                  {t("rota.volunteer")}
                </th>
                {days.map((d) => {
                  const dateStr = ymd(d);
                  return (
                    <th key={dateStr} className="px-2 py-2 text-center font-medium border-b border-l min-w-[140px]">
                      <div className="flex flex-col items-center">
                        <span>
                          {DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {volunteers.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="px-3 py-2 sticky left-0 bg-card z-10 border-r">
                    <div className="font-medium">{v.name ?? "—"}</div>
                    {v.role_type && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{v.role_type}</div>
                    )}
                  </td>
                  {days.map((d) => {
                    const date = ymd(d);
                    const value = grid[v.id]?.[date] ?? null;
                    const tpl = value && value !== OFF_KEY ? tplById[value] : null;
                    const label = value === null ? "–" : value === OFF_KEY ? "Off" : tpl?.name ?? "–";
                    const cls =
                      value === null
                        ? EMPTY_CLS
                        : value === OFF_KEY
                          ? OFF_CLS
                          : tpl
                            ? colorFor(tpl.name)
                            : EMPTY_CLS;
                    return (
                      <td key={date} className="p-1 align-middle border-l">
                        <select
                          value={value ?? ""}
                          onChange={(e) => {
                            const v2 = e.target.value;
                            setCell(v.id, date, v2 === "" ? null : v2);
                          }}
                          className={`w-full rounded-md border px-2 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary ${cls}`}
                          title={label}
                        >
                          <option value="">{t("rota.empty")}</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                          <option value={OFF_KEY}>Off</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          ["Breakfast", "bg-orange-100 text-orange-900"],
          ["Housekeeping", "bg-emerald-100 text-emerald-900"],
          ["Laundry", "bg-blue-100 text-blue-900"],
          ["Cottages", "bg-teal-100 text-teal-900"],
          ["Maintenance", "bg-amber-200 text-amber-900"],
          ["Deep Cleaning", "bg-purple-100 text-purple-900"],
          ["Special Task", "bg-red-100 text-red-900"],
          ["Family Dinners", "bg-pink-100 text-pink-900"],
          ["Off", "bg-muted text-muted-foreground"],
        ].map(([label, cls]) => (
          <span key={label} className={`rounded-md px-2 py-1 ${cls}`}>
            {label}
          </span>
        ))}
      </div>

      <div className="pt-4 border-t">
        <AmenitizUpload />
      </div>
    </div>
  );
}
