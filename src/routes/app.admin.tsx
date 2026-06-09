import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Settings, Plus, UserCheck, UserX, Inbox, Users, Send, Copy, MessageCircle, Download, Printer, QrCode, X } from "lucide-react";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

const VOLUNTEER_ROLES = ["Housekeeping", "Maintenance", "Special Task", "Family", "Team Leader"] as const;

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/app/dashboard" });
  }, [loading, isAdmin, navigate]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Settings className="h-6 w-6 text-accent" /> {t("admin.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.sub")}</p>
      </header>

      <Tabs defaultValue="volunteers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="volunteers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> {t("admin.tabVolunteers")}</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Tasks</TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-1.5"><QrCode className="h-3.5 w-3.5" /> Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="volunteers" className="space-y-6">
          <VolunteersSection currentAuthUserId={user?.id ?? null} />
          <PendingRequests />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <TasksSection />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          <WelcomeQR />
        </TabsContent>
      </Tabs>
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
  whatsapp_number: string | null;
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
  const { t } = useI18n();

  const reload = async () => {
    const { data } = await hostackSupabase
      .from("volunteers")
      .select("id, name, role_type, start_date, end_date, status, whatsapp_number, email, auth_user_id")
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
      whatsapp_number: whatsapp || null,
      status: "active",
    });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    await createInvitation(name, role, whatsapp);
    toast.success("Volunteer added");
    setName(""); setStartDate(""); setEndDate(""); setWhatsapp(""); setRole("Housekeeping");
    await reload();
    setSubmitting(false);
  };

  const sendInvite = async (v: Volunteer) => {
    if (!v.name) return;
    await createInvitation(v.name, v.role_type ?? "volunteer", v.whatsapp_number ?? "");
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

// =================== Tasks section ===================

type ShiftTaskAdmin = {
  id: string;
  shift_date: string;
  title: string;
  notes: string | null;
  volunteer_id: string;
  volunteers: { name: string | null } | null;
};

function TasksSection() {
  const [volunteers, setVolunteers] = useState<{ id: string; name: string | null }[]>([]);
  const [tasks, setTasks] = useState<ShiftTaskAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [volId, setVolId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const todayStr = new Date().toISOString().split("T")[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const reload = async () => {
    const [{ data: vols }, { data: taskData }] = await Promise.all([
      hostackSupabase
        .from("volunteers")
        .select("id, name")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("status", "active")
        .order("name"),
      hostackSupabase
        .from("shift_tasks")
        .select("id, shift_date, title, notes, volunteer_id, volunteers(name)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", todayStr)
        .lte("shift_date", weekEndStr)
        .order("shift_date", { ascending: true }),
    ]);
    setVolunteers((vols as { id: string; name: string | null }[]) ?? []);
    setTasks((taskData as unknown as ShiftTaskAdmin[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!volId || !title.trim() || !date) return;
    setSubmitting(true);
    const { data: authUser } = await hostackSupabase.auth.getUser();
    const { error } = await hostackSupabase.from("shift_tasks").insert({
      property_id: TORRIDONIA_PROPERTY_ID,
      shift_date: date,
      volunteer_id: volId,
      title: title.trim(),
      notes: notes.trim() || null,
      created_by: authUser?.user?.id ?? null,
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success("Task assigned");
      setTitle(""); setNotes(""); setVolId("");
      await reload();
    }
    setSubmitting(false);
  };

  const deleteTask = async (id: string) => {
    await hostackSupabase.from("shift_tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent" /> Assign extra task
        </h2>
        <p className="text-sm text-muted-foreground">Add a specific task to a volunteer's shift. It will appear in their dashboard alongside their main shift.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Select value={volId} onValueChange={setVolId}>
            <SelectTrigger><SelectValue placeholder="Select volunteer…" /></SelectTrigger>
            <SelectContent>
              {volunteers.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name ?? "—"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Task title (e.g. Clean Cottage 3)" value={title} onChange={(e) => setTitle(e.target.value)} className="sm:col-span-2" />
          <Textarea placeholder="Additional notes or instructions (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="sm:col-span-2 resize-none" rows={2} />
        </div>
        <Button onClick={submit} disabled={submitting || !volId || !title.trim()} className="gap-2">
          <Plus className="h-4 w-4" /> {submitting ? "Saving…" : "Assign task"}
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-3">
        <h2 className="font-display text-xl font-semibold">Upcoming tasks (next 7 days)</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No extra tasks assigned yet.</p>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => (
              <div key={task.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {task.volunteers?.name ?? "—"} · {task.shift_date}
                  </p>
                  {task.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{task.notes}</p>}
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => deleteTask(task.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
