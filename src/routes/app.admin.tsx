import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_TYPES, TASK_TYPE_LABELS, TASK_TYPE_DOT, type TaskType } from "@/lib/constants";
import { CHECKLIST_PRESETS } from "@/lib/checklist-presets";
import { toast } from "sonner";
import { Settings, Plus, BarChart3, X, Home, Sparkles, Settings2, UserCheck, UserX, Inbox } from "lucide-react";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

function AdminPage() {
  const { isAdmin, loading } = useAuth();
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
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <Settings className="h-6 w-6 text-accent" /> {t("admin.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("admin.sub")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/app/admin/rota">
            <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"><Sparkles className="h-4 w-4" /> Weekly Rota Builder</Button>
          </Link>
          <Link to="/app/rooms">
            <Button variant="outline" className="gap-2"><Home className="h-4 w-4" /> Rooms & Cottages</Button>
          </Link>
          <Link to="/app/admin/templates">
            <Button variant="outline" className="gap-2"><Settings2 className="h-4 w-4" /> Checklists</Button>
          </Link>
          <Link to="/app/admin/stats">
            <Button variant="outline" className="gap-2"><BarChart3 className="h-4 w-4" /> Volunteer stats</Button>
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> {t("admin.assign")}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder={t("admin.titlePh")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_TYPES.map((tt) => <SelectItem key={tt} value={tt}>{TASK_TYPE_LABELS[tt]}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger><SelectValue placeholder={t("admin.assignTo")} /></SelectTrigger>
            <SelectContent>{volunteers.map((v) => <SelectItem key={v.id} value={v.id}>{v.full_name || v.email}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder={t("admin.locationPh")} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <Textarea placeholder={t("admin.notesPh")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <div className="rounded-xl border bg-secondary/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${TASK_TYPE_DOT[type]}`} />
              Checklist for {TASK_TYPE_LABELS[type]}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add step</Button>
          </div>
          <div className="space-y-2">
            {checklist.map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input value={item} onChange={(e) => updateItem(i, e.target.value)} placeholder="Step description" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            {checklist.length === 0 && <p className="text-xs text-muted-foreground">No steps — the volunteer will only see the task title.</p>}
          </div>
        </div>

        <Button onClick={create} disabled={!title || !date || submitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
          {submitting ? "Creating…" : t("admin.create")}
        </Button>
      </div>

      <div className="rounded-2xl border border-dashed bg-secondary/30 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">{t("admin.volunteers")} ({volunteers.length})</p>
        <ul className="space-y-1">
          {volunteers.map((v) => <li key={v.id}>{v.full_name || "—"} · {v.email}</li>)}
        </ul>
      </div>
    </div>
  );
}
