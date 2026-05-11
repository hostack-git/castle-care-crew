import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ROOM_STATUS_OPTIONS, ROOM_STATUS_MAP, TEAM_OPTIONS, TEAM_MAP, DAY_LABELS,
  type RoomStatus, type TeamAssignment,
} from "@/lib/rota-constants";
import { addDays, fmtDate, startOfWeek } from "@/lib/constants";
import {
  ChevronLeft, ChevronRight, Copy, Upload, Save, Sparkles, ArrowLeft, Settings2,
  Home as HomeIcon, Users, ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/rota")({ component: RotaBuilderPage });

type Room = { id: string; name: string; kind: "room" | "cottage" };
type Volunteer = { id: string; full_name: string | null; email: string | null };
type RoomCell = { room_id: string; day: string; status: RoomStatus };
type TeamCell = { user_id: string; day: string; assignment: TeamAssignment; note: string | null };
type Checkin = { day: string; responsible_id: string | null };

function RotaBuilderPage() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [rotaStatus, setRotaStatus] = useState<"draft" | "published">("draft");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [roomCells, setRoomCells] = useState<Map<string, RoomStatus>>(new Map());
  const [teamCells, setTeamCells] = useState<Map<string, TeamAssignment>>(new Map());
  const [checkins, setCheckins] = useState<Map<string, string | null>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/app/dashboard" });
  }, [loading, isAdmin, navigate]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Initial: rooms + volunteers
  useEffect(() => {
    Promise.all([
      supabase.from("rooms").select("id, name, kind").order("kind").order("name"),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]).then(([r, p]) => {
      setRooms((r.data as Room[]) ?? []);
      setVolunteers((p.data as Volunteer[]) ?? []);
    });
  }, []);

  // Per-week: ensure rota and load cells
  const loadWeek = useCallback(async () => {
    setLoadingData(true);
    const ws = fmtDate(weekStart);
    let { data: rota } = await supabase
      .from("weekly_rotas")
      .select("id, status")
      .eq("week_start", ws)
      .maybeSingle();
    if (!rota) {
      const { data: created, error } = await supabase
        .from("weekly_rotas")
        .insert({ week_start: ws, created_by: user?.id ?? null })
        .select("id, status")
        .single();
      if (error) { toast.error(error.message); setLoadingData(false); return; }
      rota = created;
    }
    setRotaId(rota.id);
    setRotaStatus(rota.status as "draft" | "published");

    const [{ data: rc }, { data: tc }, { data: ci }] = await Promise.all([
      supabase.from("rota_room_cells").select("room_id, day, status").eq("rota_id", rota.id),
      supabase.from("rota_team_cells").select("user_id, day, assignment").eq("rota_id", rota.id),
      supabase.from("rota_checkins").select("day, responsible_id").eq("rota_id", rota.id),
    ]);
    setRoomCells(new Map((rc ?? []).map((c: any) => [`${c.room_id}|${c.day}`, c.status])));
    setTeamCells(new Map((tc ?? []).map((c: any) => [`${c.user_id}|${c.day}`, c.assignment])));
    setCheckins(new Map((ci ?? []).map((c: any) => [c.day, c.responsible_id])));
    setLoadingData(false);
  }, [weekStart, user?.id]);

  useEffect(() => { if (isAdmin) loadWeek(); }, [isAdmin, loadWeek]);

  if (!isAdmin) return null;

  const setRoom = async (roomId: string, day: Date, status: RoomStatus | "") => {
    if (!rotaId) return;
    const dayStr = fmtDate(day);
    const key = `${roomId}|${dayStr}`;
    if (!status) {
      setRoomCells((m) => { const n = new Map(m); n.delete(key); return n; });
      await supabase.from("rota_room_cells").delete().eq("rota_id", rotaId).eq("room_id", roomId).eq("day", dayStr);
      return;
    }
    setRoomCells((m) => new Map(m).set(key, status));
    const { error } = await supabase.from("rota_room_cells").upsert(
      { rota_id: rotaId, room_id: roomId, day: dayStr, status },
      { onConflict: "rota_id,room_id,day" },
    );
    if (error) toast.error(error.message);
  };

  const setTeam = async (userId: string, day: Date, assignment: TeamAssignment | "") => {
    if (!rotaId) return;
    const dayStr = fmtDate(day);
    const key = `${userId}|${dayStr}`;
    if (!assignment) {
      setTeamCells((m) => { const n = new Map(m); n.delete(key); return n; });
      await supabase.from("rota_team_cells").delete().eq("rota_id", rotaId).eq("user_id", userId).eq("day", dayStr);
      return;
    }
    setTeamCells((m) => new Map(m).set(key, assignment));
    const { error } = await supabase.from("rota_team_cells").upsert(
      { rota_id: rotaId, user_id: userId, day: dayStr, assignment },
      { onConflict: "rota_id,user_id,day" },
    );
    if (error) toast.error(error.message);
  };

  const setCheckin = async (day: Date, responsibleId: string | "") => {
    if (!rotaId) return;
    const dayStr = fmtDate(day);
    if (!responsibleId) {
      setCheckins((m) => { const n = new Map(m); n.delete(dayStr); return n; });
      await supabase.from("rota_checkins").delete().eq("rota_id", rotaId).eq("day", dayStr);
      return;
    }
    setCheckins((m) => new Map(m).set(dayStr, responsibleId));
    const { error } = await supabase.from("rota_checkins").upsert(
      { rota_id: rotaId, day: dayStr, responsible_id: responsibleId },
      { onConflict: "rota_id,day" },
    );
    if (error) toast.error(error.message);
  };

  const duplicateLastWeek = async () => {
    if (!rotaId) return;
    const prevStart = addDays(weekStart, -7);
    const { data: prev } = await supabase
      .from("weekly_rotas").select("id").eq("week_start", fmtDate(prevStart)).maybeSingle();
    if (!prev) return toast.error("No rota found for last week.");

    const [{ data: rc }, { data: tc }, { data: ci }] = await Promise.all([
      supabase.from("rota_room_cells").select("room_id, day, status").eq("rota_id", prev.id),
      supabase.from("rota_team_cells").select("user_id, day, assignment, note").eq("rota_id", prev.id),
      supabase.from("rota_checkins").select("day, responsible_id").eq("rota_id", prev.id),
    ]);
    const shift = (d: string) => fmtDate(addDays(new Date(d + "T00:00:00"), 7));

    const rcRows = (rc ?? []).map((c: any) => ({ rota_id: rotaId, room_id: c.room_id, day: shift(c.day), status: c.status }));
    const tcRows = (tc ?? []).map((c: any) => ({ rota_id: rotaId, user_id: c.user_id, day: shift(c.day), assignment: c.assignment, note: c.note }));
    const ciRows = (ci ?? []).map((c: any) => ({ rota_id: rotaId, day: shift(c.day), responsible_id: c.responsible_id }));

    if (rcRows.length) await supabase.from("rota_room_cells").upsert(rcRows, { onConflict: "rota_id,room_id,day" });
    if (tcRows.length) await supabase.from("rota_team_cells").upsert(tcRows, { onConflict: "rota_id,user_id,day" });
    if (ciRows.length) await supabase.from("rota_checkins").upsert(ciRows, { onConflict: "rota_id,day" });
    toast.success("Last week duplicated.");
    loadWeek();
  };

  const publish = async () => {
    if (!rotaId) return;
    await supabase.from("weekly_rotas").update({ status: "published", published_at: new Date().toISOString() }).eq("id", rotaId);
    setRotaStatus("published");
    toast.success("Rota saved & published.");
  };

  const generateTasks = async () => {
    if (!rotaId) return;
    setGenerating(true);
    try {
      const { data: templates } = await supabase.from("task_templates").select("kind, items");
      const tplMap = new Map<string, string[]>((templates ?? []).map((t: any) => [t.kind, t.items ?? []]));
      const roomById = new Map(rooms.map((r) => [r.id, r]));

      type TaskInsert = {
        rota_id: string; rota_scope_key: string;
        title: string; type: string; scheduled_date: string;
        assigned_to: string | null; location: string | null; notes: string | null;
        created_by: string | null;
      };
      const taskRows: TaskInsert[] = [];

      // Rooms: to_clean → cleaning task; check_in → prep task
      for (const [k, status] of roomCells.entries()) {
        const [roomId, day] = k.split("|");
        const room = roomById.get(roomId);
        if (!room) continue;
        if (status === "to_clean") {
          taskRows.push({
            rota_id: rotaId, rota_scope_key: `room:${roomId}:clean:${day}`,
            title: `Clean ${room.name}`,
            type: room.kind === "cottage" ? "cottages" : "housekeeping",
            scheduled_date: day, assigned_to: null,
            location: room.name, notes: null, created_by: user?.id ?? null,
          });
        } else if (status === "check_in") {
          taskRows.push({
            rota_id: rotaId, rota_scope_key: `room:${roomId}:checkin:${day}`,
            title: `Check-in prep — ${room.name}`,
            type: "special",
            scheduled_date: day, assigned_to: null,
            location: room.name, notes: null, created_by: user?.id ?? null,
          });
        }
      }

      // Team assignments
      for (const [k, assignment] of teamCells.entries()) {
        const [userId, day] = k.split("|");
        if (assignment === "off") continue;
        const map: Record<TeamAssignment, { type: string; title: string }> = {
          housekeeping:  { type: "housekeeping", title: "Housekeeping shift" },
          cottages:      { type: "cottages",     title: "Cottages cleaning" },
          breakfast:     { type: "breakfast",    title: "Breakfast service" },
          maintenance:   { type: "maintenance",  title: "Maintenance" },
          off:           { type: "special",      title: "Off" },
          special:       { type: "special",      title: "Special task" },
          onboarding:    { type: "special",      title: "Onboarding" },
          deep_cleaning: { type: "housekeeping", title: "Deep cleaning" },
          departure:     { type: "special",      title: "Departure support" },
          arrive:        { type: "special",      title: "Arrival" },
        };
        const m = map[assignment];
        taskRows.push({
          rota_id: rotaId, rota_scope_key: `vol:${userId}:${assignment}:${day}`,
          title: m.title, type: m.type, scheduled_date: day,
          assigned_to: userId, location: null, notes: null, created_by: user?.id ?? null,
        });
      }

      // Check-ins
      for (const [day, responsibleId] of checkins.entries()) {
        if (!responsibleId) continue;
        taskRows.push({
          rota_id: rotaId, rota_scope_key: `checkin:${day}`,
          title: "Daily check-ins",
          type: "special", scheduled_date: day,
          assigned_to: responsibleId, location: null, notes: null,
          created_by: user?.id ?? null,
        });
      }

      if (taskRows.length === 0) {
        toast.info("Nothing to generate yet.");
        setGenerating(false); setConfirmOpen(false); return;
      }

      // Idempotent: delete previously-generated for this rota then insert fresh
      // (re-generation also clears their checklist items via ON DELETE, but
      // task_checklist_items has no FK; so delete items explicitly first)
      const { data: oldTasks } = await supabase.from("tasks").select("id").eq("rota_id", rotaId);
      const oldIds = (oldTasks ?? []).map((t: any) => t.id);
      if (oldIds.length) {
        await supabase.from("task_checklist_items").delete().in("task_id", oldIds);
        await supabase.from("tasks").delete().in("id", oldIds);
      }

      const { data: inserted, error } = await supabase.from("tasks").insert(taskRows).select("id, type, title, rota_scope_key");
      if (error) throw error;

      // Build checklist items per task
      const itemRows: { task_id: string; label: string; order_index: number }[] = [];
      const tplFor = (taskType: string, scopeKey: string) => {
        if (scopeKey.startsWith("room:")) {
          if (scopeKey.includes(":checkin:")) return tplMap.get("checkin") ?? [];
          // cleaning: pick by room kind via taskType
          return taskType === "cottages" ? tplMap.get("cottage_clean") ?? [] : tplMap.get("room_clean") ?? [];
        }
        if (scopeKey.startsWith("vol:")) {
          const a = scopeKey.split(":")[2] as TeamAssignment;
          if (a === "breakfast") return tplMap.get("breakfast") ?? [];
          if (a === "maintenance") return tplMap.get("maintenance") ?? [];
          if (a === "deep_cleaning") return tplMap.get("deep_clean") ?? [];
          if (a === "onboarding") return tplMap.get("onboarding") ?? [];
          if (a === "housekeeping") return tplMap.get("room_clean") ?? [];
          if (a === "cottages") return tplMap.get("cottage_clean") ?? [];
          return [];
        }
        if (scopeKey.startsWith("checkin:")) return tplMap.get("checkin") ?? [];
        return [];
      };
      for (const t of inserted ?? []) {
        const items = tplFor(t.type, t.rota_scope_key as string);
        items.forEach((label, i) => itemRows.push({ task_id: t.id, label, order_index: i }));
      }
      if (itemRows.length) {
        await supabase.from("task_checklist_items").insert(itemRows);
      }

      // Mark rota published
      await supabase.from("weekly_rotas").update({ status: "published", published_at: new Date().toISOString() }).eq("id", rotaId);
      setRotaStatus("published");
      toast.success(`Generated ${inserted?.length ?? 0} tasks.`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate tasks.");
    } finally {
      setGenerating(false);
      setConfirmOpen(false);
    }
  };

  // Summary counts
  const summary = useMemo(() => {
    const roomsToClean = Array.from(roomCells.values()).filter((s) => s === "to_clean").length;
    const checkInsCount = Array.from(roomCells.values()).filter((s) => s === "check_in").length;
    const volunteersOff = Array.from(teamCells.values()).filter((a) => a === "off").length;
    const teamTasks = Array.from(teamCells.values()).filter((a) => a !== "off").length;
    const ciTasks = Array.from(checkins.values()).filter(Boolean).length;
    return { auto: roomsToClean + checkInsCount + teamTasks + ciTasks, roomsToClean, checkInsCount, volunteersOff };
  }, [roomCells, teamCells, checkins]);

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  const mainHouse = rooms.filter((r) => r.kind === "room");
  const cottages = rooms.filter((r) => r.kind === "cottage");

  return (
    <div className="space-y-6 -mx-4 lg:-mx-6 px-4 lg:px-6">
      <Link to="/app/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Link>

      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" /> Weekly Rota Builder
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Plan the week faster and generate tasks automatically.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={duplicateLastWeek}><Copy className="h-4 w-4" /> Duplicate last week</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("CSV import coming soon.")}><Upload className="h-4 w-4" /> Import CSV</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={publish}><Save className="h-4 w-4" /> Save draft</Button>
          <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setConfirmOpen(true)}>
            <Sparkles className="h-4 w-4" /> Generate Tasks
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Grid */}
        <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-secondary/30">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
              <p className="font-display text-lg font-semibold">{weekLabel}</p>
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
              <Badge variant={rotaStatus === "published" ? "default" : "secondary"} className="ml-2">{rotaStatus}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-secondary/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left p-3 sticky left-0 bg-secondary/40 z-10 min-w-[180px]">Row</th>
                  {days.map((d, i) => (
                    <th key={i} className="p-2 text-center min-w-[120px]">
                      <div>{DAY_LABELS[i]}</div>
                      <div className="text-foreground font-semibold">{d.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SectionHeader icon={<HomeIcon className="h-4 w-4" />} label="Room Rota" />
                {mainHouse.map((r) => (
                  <RoomRow key={r.id} room={r} days={days} get={(d) => roomCells.get(`${r.id}|${fmtDate(d)}`)} onSet={setRoom} />
                ))}
                {cottages.length > 0 && (
                  <tr className="border-y bg-secondary/30">
                    <td colSpan={8} className="p-2 px-3 text-xs uppercase tracking-wide text-muted-foreground font-semibold">Cottages</td>
                  </tr>
                )}
                {cottages.map((r) => (
                  <RoomRow key={r.id} room={r} days={days} get={(d) => roomCells.get(`${r.id}|${fmtDate(d)}`)} onSet={setRoom} />
                ))}

                <SectionHeader icon={<Users className="h-4 w-4" />} label="Team Rota" />
                {volunteers.map((v) => (
                  <TeamRow key={v.id} volunteer={v} days={days}
                    get={(d) => teamCells.get(`${v.id}|${fmtDate(d)}`)}
                    onSet={setTeam} />
                ))}
                {volunteers.length === 0 && (
                  <tr><td colSpan={8} className="p-4 text-center text-muted-foreground text-xs">No volunteers yet.</td></tr>
                )}

                <SectionHeader icon={<ClipboardCheck className="h-4 w-4" />} label="Check-ins" />
                <tr>
                  <td className="sticky left-0 bg-card z-10 p-3 font-medium text-sm border-r">Responsible</td>
                  {days.map((d, i) => (
                    <td key={i} className="p-1.5 align-middle">
                      <select
                        value={checkins.get(fmtDate(d)) ?? ""}
                        onChange={(e) => setCheckin(d, e.target.value)}
                        className="w-full rounded-full px-2 py-1 text-xs bg-secondary/60 border border-transparent hover:border-border focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">—</option>
                        {volunteers.map((v) => (
                          <option key={v.id} value={v.id}>{v.full_name || v.email}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="p-4 border-t bg-secondary/20 flex flex-wrap gap-2 text-xs">
            {ROOM_STATUS_OPTIONS.map((o) => (
              <span key={o.value} className={`px-2 py-1 rounded-full ${o.cls}`}>{o.label}</span>
            ))}
            <span className="w-px bg-border mx-2" />
            {TEAM_OPTIONS.map((o) => (
              <span key={o.value} className={`px-2 py-1 rounded-full ${o.cls}`}>{o.label}</span>
            ))}
          </div>
          {loadingData && <div className="p-3 text-center text-xs text-muted-foreground">Loading…</div>}
        </div>

        {/* Summary */}
        <aside className="rounded-2xl border bg-card shadow-soft p-5 space-y-4 lg:sticky lg:top-6">
          <h2 className="font-display text-lg font-semibold">Summary</h2>
          <SummaryStat icon={<Sparkles className="h-4 w-4" />} label="Auto-generated tasks" value={summary.auto} hint={summary.auto > 0 ? "Ready to generate" : "Plan some cells first"} hintClass={summary.auto > 0 ? "text-[oklch(0.55_0.10_145)]" : "text-muted-foreground"} />
          <SummaryStat icon={<HomeIcon className="h-4 w-4" />} label="Rooms to clean" value={summary.roomsToClean} hint="room cleans" />
          <SummaryStat icon={<ClipboardCheck className="h-4 w-4" />} label="Check-ins" value={summary.checkInsCount} hint="expected arrivals" />
          <SummaryStat icon={<Users className="h-4 w-4" />} label="Volunteers off" value={summary.volunteersOff} hint="shifts" />
          <div className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
            Generate tasks to create room cleans, check-ins and volunteer assignments automatically.
          </div>
          <Link to="/app/admin/templates"><Button variant="outline" size="sm" className="w-full gap-2"><Settings2 className="h-4 w-4" /> Edit checklists</Button></Link>
        </aside>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate {summary.auto} tasks?</DialogTitle>
            <DialogDescription>
              This will create the daily tasks for this week and replace any tasks previously generated from this rota. Volunteers will see them on their dashboards.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-secondary/40 p-3 text-sm space-y-1">
            <div>{summary.roomsToClean} room cleans</div>
            <div>{summary.checkInsCount} check-in preps</div>
            <div>{Array.from(teamCells.values()).filter((a) => a !== "off").length} volunteer shifts</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={generating} onClick={generateTasks}>
              {generating ? "Generating…" : "Confirm & generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <tr className="bg-primary/10">
      <td colSpan={8} className="p-2 px-3 font-display text-sm font-semibold text-primary flex items-center gap-2">
        {icon} {label}
      </td>
    </tr>
  );
}

function RoomRow({
  room, days, get, onSet,
}: {
  room: Room; days: Date[];
  get: (d: Date) => RoomStatus | undefined;
  onSet: (roomId: string, day: Date, status: RoomStatus | "") => void;
}) {
  return (
    <tr className="border-t hover:bg-secondary/20">
      <td className="sticky left-0 bg-card z-10 p-3 font-medium text-sm border-r">{room.name}</td>
      {days.map((d, i) => {
        const v = get(d);
        const opt = v ? ROOM_STATUS_MAP[v] : null;
        return (
          <td key={i} className="p-1.5 align-middle">
            <select
              value={v ?? ""}
              onChange={(e) => onSet(room.id, d, e.target.value as RoomStatus | "")}
              className={`w-full rounded-full px-2 py-1 text-xs border border-transparent appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${opt ? opt.cls : "bg-secondary/40 text-muted-foreground hover:border-border"}`}
            >
              <option value="">—</option>
              {ROOM_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </td>
        );
      })}
    </tr>
  );
}

function TeamRow({
  volunteer, days, get, onSet,
}: {
  volunteer: Volunteer; days: Date[];
  get: (d: Date) => TeamAssignment | undefined;
  onSet: (userId: string, day: Date, a: TeamAssignment | "") => void;
}) {
  return (
    <tr className="border-t hover:bg-secondary/20">
      <td className="sticky left-0 bg-card z-10 p-3 font-medium text-sm border-r">{volunteer.full_name || volunteer.email}</td>
      {days.map((d, i) => {
        const v = get(d);
        const opt = v ? TEAM_MAP[v] : null;
        return (
          <td key={i} className="p-1.5 align-middle">
            <select
              value={v ?? ""}
              onChange={(e) => onSet(volunteer.id, d, e.target.value as TeamAssignment | "")}
              className={`w-full rounded-full px-2 py-1 text-xs border border-transparent appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${opt ? opt.cls : "bg-secondary/40 text-muted-foreground hover:border-border"}`}
            >
              <option value="">—</option>
              {TEAM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </td>
        );
      })}
    </tr>
  );
}

function SummaryStat({ icon, label, value, hint, hintClass }: { icon: React.ReactNode; label: string; value: number; hint?: string; hintClass?: string }) {
  return (
    <div className="rounded-xl border bg-secondary/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="font-display text-3xl font-semibold mt-1">{value}</div>
      {hint && <div className={`text-xs mt-0.5 ${hintClass ?? "text-muted-foreground"}`}>{hint}</div>}
    </div>
  );
}
