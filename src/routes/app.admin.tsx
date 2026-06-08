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
          <TabsTrigger value="volunteers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Voluntarios</TabsTrigger>
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

function OverviewSection() {
  const [stats, setStats] = useState<{
    activeVolunteers: number;
    shiftsToday: number;
    shiftsThisWeek: number;
    upcomingDepartures: { name: string; end_date: string }[];
    upcomingArrivals: { name: string; start_date: string }[];
  } | null>(null);

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
        <div className="rounded-xl bg-secondary/40 p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Active volunteers</p>
          <p className="text-2xl font-semibold">{stats.activeVolunteers}</p>
          <p className="text-xs text-muted-foreground">on property</p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" /> Shifts today</p>
          <p className="text-2xl font-semibold">{stats.shiftsToday}</p>
          <p className="text-xs text-muted-foreground">scheduled</p>
        </div>
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
};

function VolunteersSection({ currentAuthUserId }: { currentAuthUserId: string | null }) {
  const [list, setList] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [role, setRole] = useState<typeof VOLUNTEER_ROLES[number]>("Housekeeping");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<{ url: string; name: string; whatsapp: string } | null>(null);

  const reload = async () => {
    const { data } = await hostackSupabase
      .from("volunteers")
      .select("id, name, role_type, start_date, end_date, status, whatsapp, email, auth_user_id")
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
    `https://tanstack-start-app.hostack.workers.dev/invite/${token}`;

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
      toast.error(error?.message ?? "Error creando invitación");
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
      status: "active",
    });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    await createInvitation(name, role, whatsapp);
    toast.success("Voluntario añadido");
    setName(""); setStartDate(""); setEndDate(""); setWhatsapp(""); setRole("Housekeeping");
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
            <Users className="h-4 w-4 text-accent" /> Voluntarios
          </h2>
          <span className="text-xs text-muted-foreground">{list.length}</span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay voluntarios todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2 pr-3">Inicio</th>
                  <th className="py-2 pr-3">Fin</th>
                  <th className="py-2 pr-3">Estado</th>
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
                    <td className="py-2 pr-3">
                      {v.auth_user_id ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Sin registrar</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {!v.auth_user_id && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => sendInvite(v)}>
                          <Send className="h-3.5 w-3.5" /> Invitar
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
          <Plus className="h-4 w-4 text-accent" /> Añadir voluntario
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as typeof VOLUNTEER_ROLES[number])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VOLUNTEER_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <div>
            <label className="text-xs text-muted-foreground">Fecha inicio</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fecha salida</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Input placeholder="WhatsApp (opcional)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={!name || !startDate || !endDate || submitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
          {submitting ? "Creando…" : "Crear voluntario"}
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
    toast.success("Link copiado");
  };
  const openWhatsapp = () => {
    if (!invite) return;
    const phone = invite.whatsapp.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`Hola ${invite.name}! Únete a la app de Torridonia: ${invite.url}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };
  return (
    <Dialog open={!!invite} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitación creada</DialogTitle>
          <DialogDescription>Comparte este link con {invite?.name}</DialogDescription>
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
                <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
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
          <Inbox className="h-4 w-4 text-accent" /> Solicitudes pendientes
        </h2>
        <span className="text-xs text-muted-foreground">{requests.length}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
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
                  <UserX className="h-3.5 w-3.5" /> Rechazar
                </Button>
                <Button size="sm" disabled={busyId === r.id} onClick={() => approve(r)} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
                  <UserCheck className="h-3.5 w-3.5" /> Aprobar
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

const WELCOME_QR_URL = "https://tanstack-start-app.hostack.workers.dev/join?source=qr";

// Inline SVG mountain logo as data URL for centering inside the QR
const MOUNTAIN_LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='hsl(20 80% 40%)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><rect width='24' height='24' rx='4' fill='white'/><path d='m8 3 4 8 5-5 5 15H2L8 3z' transform='translate(0 -1)'/></svg>`,
  );

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
            <QrCode className="h-4 w-4 text-accent" /> QR de bienvenida
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Los voluntarios escanean este QR al llegar para solicitar acceso al equipo.
        </p>

        <div className="print-qr flex flex-col items-center gap-4 py-4">
          <div ref={wrapperRef} className="bg-white p-4 rounded-xl border">
            <QRCodeSVG
              value={WELCOME_QR_URL}
              size={250}
              level="H"
              imageSettings={{ src: MOUNTAIN_LOGO, height: 48, width: 48, excavate: true }}
            />
          </div>
          <p className="text-xs text-muted-foreground font-mono break-all max-w-md text-center">{WELCOME_QR_URL}</p>
        </div>

        <div className="rounded-xl border bg-secondary/30 p-3 flex items-center gap-2">
          <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{WELCOME_QR_URL}</p>
          <Button
            type="button" variant="outline" size="sm" className="gap-1.5 shrink-0"
            onClick={() => { navigator.clipboard.writeText(WELCOME_QR_URL); toast.success("Link copiado"); }}
          >
            <Copy className="h-3.5 w-3.5" /> Copiar link
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={download} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Descargar QR
          </Button>
          <Button onClick={print} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>
    </>
  );
}
