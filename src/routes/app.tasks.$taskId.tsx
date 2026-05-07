import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TASK_TYPE_LABELS, TASK_TYPE_DOT, type TaskType } from "@/lib/constants";
import { ArrowLeft, Clock, MapPin, CheckCircle2, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tasks/$taskId")({ component: TaskDetailPage });

type Task = {
  id: string; title: string; type: TaskType; scheduled_date: string;
  start_time: string | null; end_time: string | null; location: string | null;
  notes: string | null; status: string; assigned_to: string | null;
};
type Item = { id: string; label: string; is_done: boolean; order_index: number };

function TaskDetailPage() {
  const { taskId } = useParams({ from: "/app/tasks/$taskId" });
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: t }, { data: cl }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase.from("task_checklist_items").select("*").eq("task_id", taskId).order("order_index"),
    ]);
    setTask((t as Task) ?? null);
    setItems((cl as Item[]) ?? []);
    if (t?.assigned_to) {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", t.assigned_to).maybeSingle();
      setAssignee(p?.full_name ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [taskId]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!task) return <p className="text-muted-foreground">Task not found.</p>;

  const isAssignee = user?.id === task.assigned_to;
  const canEdit = isAssignee || isAdmin;
  const done = items.filter((i) => i.is_done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : task.status === "completed" ? 100 : 0;

  const toggle = async (it: Item) => {
    if (!canEdit) return;
    const next = !it.is_done;
    setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, is_done: next } : x)));
    const { error } = await supabase.from("task_checklist_items").update({ is_done: next }).eq("id", it.id);
    if (error) { toast.error(error.message); load(); return; }

    // auto-update task status
    const newDone = items.map((x) => (x.id === it.id ? { ...x, is_done: next } : x)).filter((i) => i.is_done).length;
    let newStatus: "completed" | "in_progress" | "pending" | null = null;
    if (items.length > 0 && newDone === items.length) newStatus = "completed";
    else if (newDone > 0 && task.status === "pending") newStatus = "in_progress";
    else if (newDone === 0 && task.status !== "pending") newStatus = "pending";
    if (newStatus && newStatus !== task.status) {
      await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
      setTask({ ...task, status: newStatus });
    }
  };

  const markComplete = async () => {
    if (!canEdit) return;
    const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", task.id);
    if (error) return toast.error(error.message);
    if (items.length) {
      await supabase.from("task_checklist_items").update({ is_done: true }).eq("task_id", task.id);
    }
    toast.success("Marked complete!");
    load();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to="/app/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TASK_TYPE_DOT[task.type]}`} />
            {TASK_TYPE_LABELS[task.type]}
          </Badge>
          <Badge variant={task.status === "completed" ? "default" : "outline"}>
            {task.status === "completed" ? "Completed" : task.status === "in_progress" ? "In progress" : "Pending"}
          </Badge>
        </div>
        <h1 className="font-display text-3xl font-semibold">{task.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{new Date(task.scheduled_date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
          {task.start_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{task.start_time.slice(0, 5)}{task.end_time ? ` – ${task.end_time.slice(0, 5)}` : ""}</span>}
          {task.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{task.location}</span>}
          {assignee && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{assignee}</span>}
        </div>
        {task.notes && <p className="rounded-xl bg-secondary/40 p-4 text-sm">{task.notes}</p>}
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Checklist</h2>
          <span className="text-sm text-muted-foreground">{done} / {items.length}</span>
        </div>
        <Progress value={pct} />

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checklist items for this task.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className={`flex items-start gap-3 rounded-xl border p-4 bg-card transition ${it.is_done ? "opacity-60" : ""} ${canEdit ? "cursor-pointer hover:shadow-warm" : ""}`}
                onClick={() => toggle(it)}
              >
                <Checkbox checked={it.is_done} disabled={!canEdit} className="mt-0.5" />
                <span className={`text-sm ${it.is_done ? "line-through" : ""}`}>{it.label}</span>
              </li>
            ))}
          </ul>
        )}

        {canEdit && task.status !== "completed" && (
          <Button onClick={markComplete} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
            <CheckCircle2 className="h-4 w-4" /> Mark task as complete
          </Button>
        )}
        {!canEdit && <p className="text-xs text-muted-foreground">Only the assigned volunteer or an admin can update this checklist.</p>}
      </section>
    </div>
  );
}
