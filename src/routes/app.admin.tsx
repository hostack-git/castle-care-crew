import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TASK_TYPES, TASK_TYPE_LABELS, TASK_TYPE_DOT, type TaskType } from "@/lib/constants";
import { CHECKLIST_PRESETS } from "@/lib/checklist-presets";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Settings, Plus, BarChart3, X, Home, Sparkles, Settings2, UserCheck, UserX, Inbox, Users, Send, Copy, MessageCircle, Download, Printer, QrCode, Clock, TrendingUp, CalendarCheck, UserPlus } from "lucide-react";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

const VOLUNTEER_ROLES = ["Housekeeping", "Maintenance", "Special Task", "Family", "Team Leader"] as const;

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("housekeeping");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [assignee, setAssignee] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<string[]>(CHECKLIST_PRESETS.housekeeping);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/app/dashboard" });
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, email").then(({ data }) => setVolunteers(data ?? []));
  }, []);

  useEffect(() => {
    setChecklist(CHECKLIST_PRESETS[type]);
  }, [type]);

  const updateItem = (i: number, v: string) => setChecklist((c) => c.map((x, j) => (j === i ? v : x)));
  const removeItem = (i: number) => setChecklist((c) => c.filter((_, j) => j !== i));
  const addItem = () => setChecklist((c) => [...c, ""]);

  const create = async () => {
    if (!title || !date) return;
    setSubmitting(true);
    const { data: task, error } = await supabase.from("tasks").insert({
      title, type, scheduled_date: date,
      start_time: start || null, assigned_to: assignee || null,
      location: location || null, notes: notes || null,
    }).select("id").single();
    if (error || !task) { setSubmitting(false); return toast.error(error?.message ?? "Error"); }

    const items = checklist.map((label, i) => ({ task_id: task.id, label: label.trim(), order_index: i }))
      .filter((it) => it.label.length > 0);
    if (items.length) {
      const { error: cErr } = await supabase.from("task_checklist_items").insert(items);
      if (cErr) toast.error(cErr.message);
    }
    toast.success("Task created!");
    setTitle(""); setDate(""); setStart(""); setAssignee(""); setLocation(""); setNotes("");
    setChecklist(CHECKLIST_PRESETS[type]);
    setSubmitting(false);
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Settings className="h-6 w-6 text-accent" /> {t("admin.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.sub")}</p>
      </header>

      <Tabs defaultValue="overview" className="space-y-4">
       <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="volunteers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> {t("admin.tabVolunteers")}</TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-1.5"><QrCode className="h-3.5 w-3.5" /> Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewSection />
        </TabsContent>

        <TabsContent value="volunteers" className="space-y-6">
          <VolunteersSection currentAuthUserId={user?.id ?? null} />
          <PendingRequests />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          <WelcomeQR />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =================== Overview section ===================

type VolDetail = { id: string; name: string | null; role_type: string | null; start_date: string | null; end_date: string | null; room: string | null; whatsapp: string | null };
type ShiftDetail = { id: string; volunteer_id: string | null; volunteers: { name: string | null; whatsapp: string | null } | null; shift_templates: { name: string | null; start_time: string | null; end_time: string | null } | null };

function OverviewSection() {
  const { t } = useI18n();
  const [stats, setStats] = useState<{
    activeVolunteers: number;
    shiftsToday: number;
    shiftsThisWeek: number;
    upcomingDepartures: { name: string; end_date: string }[];
    upcomingArrivals: { name: string; start_date: string }[];
  } | null>(null);

  const [showVolunteers, setShowVolunteers] = useState(false);
  const [volOnProperty, setVolOnProperty] = useState<VolDetail[]>([]);
  const [loadingVols, setLoadingVols] = useState(false);

  const [showShifts, setShowShifts] = useState(false);
  const [shiftsToday, setShiftsToday] = useState<ShiftDetail[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);

  useEffect(() => {
    if (!showVolunteers) return;
    setLoadingVols(true);
    hostackSupabase
      .from("volunteers")
      .select("id, name, role_type, start_date, end_date, room, whatsapp")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("status", "active")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!error) setVolOnProperty((data as VolDetail[]) ?? []);
        setLoadingVols(false);
      });
  }, [showVolunteers]);

  useEffect(() => {
    if (!showShifts) return;
    setLoadingShifts(true);
    const today = new Date().toISOString().split("T")[0];
    Promise.all([
      hostackSupabase
        .from("shifts")
        .select("id, volunteer_id, shift_templates(name, start_time, end_time)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("shift_date", today)
        .eq("status", "scheduled"),
      hostackSupabase
        .from("volunteers")
        .select("id, name, whatsapp")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("status", "active"),
    ]).then(([shiftsRes, volsRes]) => {
      const volMap = new Map(
        (volsRes.data ?? []).map((v: { id: string; name: string | null; whatsapp: string | null }) => [v.id, v])
      );
      const merged = (shiftsRes.data ?? []).map((s: { id: string; volunteer_id: string | null; shift_templates: unknown }) => ({
        ...s,
        volunteers: s.volunteer_id ? (volMap.get(s.volunteer_id) ?? null) : null,
      }));
      setShiftsToday(merged as ShiftDetail[]);
      setLoadingShifts(false);
    });
  }, [showShifts]);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      const [volRes, shiftsTodayRes, shiftsWeekRes, depsRes, arrivalsRes] = await Promise.all([
        hostackSupabase.from("volunteers").select("id", { count: "exact" })
          .eq("property_id", TORRIDONIA_PROPERTY_ID).eq("status", "active"),
        hostackSupabase.from("shifts").select("id", { count: "exact" })
          .eq("property_id", TORRIDONIA_PROPERTY_ID).eq("shift_date", today).eq("status", "scheduled"),
        hostackSupabase.from("shifts").select("id", { count: "exact" })
          .eq("property_id", TORRIDONIA_PROPERTY_ID).eq("status", "scheduled")
          .gte("shift_date", today).lte("shift_date", weekEndStr),
        hostackSupabase.from("volunteers").select("name, end_date")
          .eq("property_id", TORRIDONIA_PROPERTY_ID).eq("status", "active")
          .gte("end_date", today).lte("end_date", weekEndStr)
          .order("end_date", { ascending: true }),
        hostackSupabase.from("volunteers").select("name, start_date")
          .eq("property_id", TORRIDONIA_PROPERTY_ID).eq("status", "active")
          .gte("start_date", today).lte("start_date", weekEndStr)
          .order("start_date", { ascending: true }),
      ]);

      setStats({
        activeVolunteers: volRes.count ?? 0,
        shiftsToday: shiftsTodayRes.count ?? 0,
        shiftsThisWeek: shiftsWeekRes.count ?? 0,
        upcomingDepartures: (depsRes.data ?? []) as { name: string; end_date: string }[],
        upcomingArrivals: (arrivalsRes.data ?? []) as { name: string; start_date: string }[],
      });
    };
    load();
  }, []);

  const minutesSavedToday = (stats?.shiftsToday ?? 0) * 2;
  const minutesSavedMonth = minutesSavedToday * 20;
  const hoursSavedMonth = (minutesSavedMonth / 60).toFixed(1);

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  if (!stats) return <p className="text-sm text-muted-foreground">Loading overview…</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setShowVolunteers(true)} className="rounded-xl bg-secondary/40 p-4 space-y-1 text-left cursor-pointer hover:bg-secondary/60 transition">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Active volunteers</p>
          <p className="text-2xl font-semibold">{stats.activeVolunteers}</p>
          <p className="text-xs text-muted-foreground">{t("admin.volOnProperty")}</p>
        </button>
        <button onClick={() => setShowShifts(true)} className="rounded-xl bg-secondary/40 p-4 space-y-1 text-left cursor-pointer hover:bg-secondary/60 transition">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" /> Shifts today</p>
          <p className="text-2xl font-semibold">{stats.shiftsToday}</p>
          <p className="text-xs text-muted-foreground">scheduled</p>
        </button>
        <div className="rounded-xl bg-secondary/40 p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time saved today</p>
          <p className="text-2xl font-semibold">{minutesSavedToday} min</p>
          <p className="text-xs text-muted-foreground">vs. manual briefing</p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Saved this month</p>
          <p className="text-2xl font-semibold">{hoursSavedMonth} hrs</p>
          <p className="text-xs text-muted-foreground">estimated</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-soft space-y-3">
          <h3 className="font-medium text-sm flex items-center gap-2"><UserX className="h-4 w-4 text-amber-500" /> Departures this week</h3>
          {stats.upcomingDepartures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No departures this week.</p>
          ) : (
            <ul className="divide-y">
              {stats.upcomingDepartures.map((v) => (
                <li key={v.name} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">{formatDate(v.end_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-soft space-y-3">
          <h3 className="font-medium text-sm flex items-center gap-2"><UserPlus className="h-4 w-4 text-emerald-500" /> Arrivals this week</h3>
          {stats.upcomingArrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No arrivals this week.</p>
          ) : (
            <ul className="divide-y">
              {stats.upcomingArrivals.map((v) => (
                <li key={v.name} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">{formatDate(v.start_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> Time saved by Hostack</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Per briefing</p>
            <p className="text-lg font-semibold">2 min</p>
            <p className="text-xs text-muted-foreground">per volunteer</p>
          </div>
          <div className="border-x">
            <p className="text-xs text-muted-foreground mb-1">Today total</p>
            <p className="text-lg font-semibold">{minutesSavedToday} min</p>
            <p className="text-xs text-muted-foreground">{stats.shiftsToday} volunteers</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">This month</p>
            <p className="text-lg font-semibold">~{hoursSavedMonth} hrs</p>
            <p className="text-xs text-muted-foreground">manager time</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          Baseline: 2 min/volunteer briefing saved vs. manual WhatsApp coordination (previous method: 2–4 min each).
        </p>
      </div>

      {/* Active volunteers dialog */}
      <Dialog open={showVolunteers} onOpenChange={setShowVolunteers}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Volunteers on property</DialogTitle>
            <DialogDescription>{t("admin.volOnProperty")}</DialogDescription>
          </DialogHeader>
          {loadingVols ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : volOnProperty.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.noVolunteers")}</p>
          ) : (
            <ul className="divide-y max-h-80 overflow-y-auto">
              {volOnProperty.map((v) => (
                <li key={v.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{v.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.role_type} · {v.start_date} → {v.end_date}
                      {v.room ? ` · Room ${v.room}` : ""}
                    </p>
                  </div>
                  {v.whatsapp && (
                    <a href={`https://wa.me/${v.whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Shifts today dialog */}
      <Dialog open={showShifts} onOpenChange={setShowShifts}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> Shifts today</DialogTitle>
            <DialogDescription>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</DialogDescription>
          </DialogHeader>
          {loadingShifts ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : shiftsToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts scheduled today.</p>
          ) : (
            <ul className="divide-y max-h-80 overflow-y-auto">
              {shiftsToday.map((s, i) => (
                <li key={s.id ?? i} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{s.volunteers?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.shift_templates?.name ?? "—"}
                      {s.shift_templates?.start_time ? ` · ${s.shift_templates.start_time.slice(0, 5)}` : ""}
                      {s.shift_templates?.end_time ? `–${s.shift_templates.end_time.slice(0, 5)}` : ""}
                    </p>
                  </div>
                  {s.volunteers?.whatsapp && (
                    <a href={`https://wa.me/${s.volunteers.whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
// =================== Volunteers section ===================

type Volunteer = {
  id: string;
  name: string | null;
  role_type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  whatsapp: string | null;
  email: string | null;
  auth_user_id: string | null;
  room: string | null;
};

function VolunteersSection({ currentAuthUserId }: { currentAuthUserId: string | null }) {
  const [list, setList] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [role, setRole] = useState<typeof VOLUNTEER_ROLES[number]>("Housekeeping");
  const [whatsapp, setWhatsapp] = useState("");
  const [room, setRoom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<{ url: string; name: string; whatsapp: string } | null>(null);
  const { t } = useI18n();

  const reload = async () => {
    const { data } = await hostackSupabase
      .from("volunteers")
      .select("id, name, role_type, start_date, end_date, status, whatsapp, email, auth_user_id, room")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .order("start_date", { ascending: false });
    setList((data as Volunteer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const getCurrentStaffId = async (): Promise<string | null> => {
    if (!currentAuthUserId) return null;
    const { data } = await hostackSupabase.from("staff").select("id").eq("auth_user_id", currentAuthUserId).maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };

  const buildInviteUrl = (token: string) =>
    `https://torridonia.com/staffapp/invite/${token}`;

  const createInvitation = async (volunteerName: string, roleType: string, vWhatsapp: string) => {
    const staffId = await getCurrentStaffId();
    const { data, error } = await hostackSupabase
      .from("staff_invitations")
      .insert({
        property_id: TORRIDONIA_PROPERTY_ID,
        name: volunteerName,
        role: roleType,
        email: `${volunteerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@invite.local`,
        token: crypto.randomUUID(),
        invited_by: staffId,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("token")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? t("admin.errorInvite"));
      return null;
    }
    const url = buildInviteUrl((data as { token: string }).token);
    setInvite({ url, name: volunteerName, whatsapp: vWhatsapp });
    return url;
  };

  const submit = async () => {
    if (!name || !startDate || !endDate) return;
    setSubmitting(true);
    const { error } = await hostackSupabase.from("volunteers").insert({
      property_id: TORRIDONIA_PROPERTY_ID,
      name,
      role_type: role,
      start_date: startDate,
      end_date: endDate,
      whatsapp: whatsapp || null,
      room: room || null,
      status: "active",
    });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    await createInvitation(name, role, whatsapp);
    toast.success("Volunteer added");
    setName(""); setStartDate(""); setEndDate(""); setWhatsapp(""); setRoom(""); setRole("Housekeeping");
    await reload();
    setSubmitting(false);
  };

  const sendInvite = async (v: Volunteer) => {
    if (!v.name) return;
    await createInvitation(v.name, v.role_type ?? "volunteer", v.whatsapp ?? "");
  };

  return (
    <>
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" /> {t("admin.tabVolunteers")}
          </h2>
          <span className="text-xs text-muted-foreground">{list.length}</span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.noVolunteers")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Start</th>
                  <th className="py-2 pr-3">End</th>
                  <th className="py-2 pr-3">Room</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 pr-3 font-medium">{v.name || "—"}</td>
                    <td className="py-2 pr-3">{v.role_type || "—"}</td>
                    <td className="py-2 pr-3">{v.start_date || "—"}</td>
                    <td className="py-2 pr-3">{v.end_date || "—"}</td>
                    <td className="py-2 pr-3">{v.room || "—"}</td>
                    <td className="py-2 pr-3">
                      {v.auth_user_id ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Not registered</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {!v.auth_user_id && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => sendInvite(v)}>
                          <Send className="h-3.5 w-3.5" /> {t("admin.invite")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent" /> Add volunteer
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as typeof VOLUNTEER_ROLES[number])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VOLUNTEER_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <div>
            <label className="text-xs text-muted-foreground">Start date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Input placeholder="WhatsApp (optional)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <Input placeholder="Room (optional)" value={room} onChange={(e) => setRoom(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={!name || !startDate || !endDate || submitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
          {submitting ? "Creating…" : "Create volunteer"}
        </Button>
      </div>

      <InviteDialog invite={invite} onClose={() => setInvite(null)} />
    </>
  );
}

function InviteDialog({ invite, onClose }: { invite: { url: string; name: string; whatsapp: string } | null; onClose: () => void }) {
  const copy = () => {
    if (!invite) return;
    navigator.clipboard.writeText(invite.url);
    toast.success("Link copied");
  };
  const openWhatsapp = () => {
    if (!invite) return;
    const phone = invite.whatsapp.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`Hi ${invite.name}! Join the Torridonia app: ${invite.url}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };
  return (
    <Dialog open={!!invite} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitation created</DialogTitle>
          <DialogDescription>Share this link with {invite?.name}</DialogDescription>
        </DialogHeader>
        {invite && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input readOnly value={invite.url} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copy}><Copy className="h-4 w-4" /></Button>
            </div>
            <div className="flex justify-center bg-white p-4 rounded-xl border">
              <QRCodeSVG value={invite.url} size={180} />
            </div>
            {invite.whatsapp && (
              <Button onClick={openWhatsapp} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =================== Pending access requests ===================

type AccessRequest = {
  id: string;
  name: string | null;
  email: string | null;
  whatsapp: string | null;
  auth_user_id: string | null;
  created_at: string;
  status: string;
};

function PendingRequests() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    hostackSupabase
      .from("staff_access_requests")
      .select("id, name, email, whatsapp, auth_user_id, created_at, status")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setRequests((data as AccessRequest[]) ?? []);
        setLoading(false);
      });
  }, []);

  const approve = async (req: AccessRequest) => {
    setBusyId(req.id);
    const today = new Date().toISOString().split("T")[0];
    const { error: updErr } = await hostackSupabase
      .from("staff_access_requests")
      .update({ status: "approved" })
      .eq("id", req.id);
    if (updErr) {
      setBusyId(null);
      return toast.error(updErr.message);
    }
    const { error: insErr } = await hostackSupabase.from("volunteers").insert({
      property_id: TORRIDONIA_PROPERTY_ID,
      name: req.name,
      email: req.email,
      whatsapp: req.whatsapp,
      auth_user_id: req.auth_user_id,
      role_type: "volunteer",
      status: "active",
      start_date: today,
    });
    if (insErr) {
      setBusyId(null);
      return toast.error(insErr.message);
    }
    setRequests((cur) => cur.filter((r) => r.id !== req.id));
    setBusyId(null);
    toast.success(`Approved ${req.name ?? req.email}`);
  };

  const reject = async (req: AccessRequest) => {
    setBusyId(req.id);
    const { error } = await hostackSupabase
      .from("staff_access_requests")
      .update({ status: "rejected" })
      .eq("id", req.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    setRequests((cur) => cur.filter((r) => r.id !== req.id));
    toast.success("Request rejected");
  };

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Inbox className="h-4 w-4 text-accent" /> {t("admin.pendingRequests")}
        </h2>
        <span className="text-xs text-muted-foreground">{requests.length}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
      ) : (
        <ul className="divide-y">
          {requests.map((r) => (
            <li key={r.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.name || "—"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.email}
                  {r.whatsapp ? ` · ${r.whatsapp}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => reject(r)} className="gap-1.5">
                  <UserX className="h-3.5 w-3.5" /> Reject
                </Button>
                <Button size="sm" disabled={busyId === r.id} onClick={() => approve(r)} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
                  <UserCheck className="h-3.5 w-3.5" /> Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// =================== Welcome QR ===================

const WELCOME_QR_URL = "https://torridonia.com/staffapp/join?source=qr";

function WelcomeQR() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const download = () => {
    const svg = wrapperRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const size = 1000;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = "torridonia-welcome-qr.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  };

  const print = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-qr, .print-qr * { visibility: visible !important; }
          .print-qr {
            position: fixed; inset: 0;
            display: flex; align-items: center; justify-content: center;
            background: white;
          }
        }
      `}</style>
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <QrCode className="h-4 w-4 text-accent" /> Welcome QR
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Volunteers scan this QR on arrival to request access to the team app.
        </p>

        <div className="print-qr flex flex-col items-center gap-4 py-4">
          <div ref={wrapperRef} className="bg-white p-4 rounded-xl border">
            <QRCodeSVG
              value={WELCOME_QR_URL}
              size={250}
              level="H"
            />
          </div>
          <p className="text-xs text-muted-foreground font-mono break-all max-w-md text-center">{WELCOME_QR_URL}</p>
        </div>

        <div className="rounded-xl border bg-secondary/30 p-3 flex items-center gap-2">
          <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{WELCOME_QR_URL}</p>
          <Button
            type="button" variant="outline" size="sm" className="gap-1.5 shrink-0"
            onClick={() => { navigator.clipboard.writeText(WELCOME_QR_URL); toast.success("Link copied"); }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy link
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={download} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Download QR
          </Button>
          <Button onClick={print} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>
    </>
  );
}
