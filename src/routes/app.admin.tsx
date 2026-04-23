import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_TYPES, TASK_TYPE_LABELS, type TaskType } from "@/lib/constants";
import { toast } from "sonner";
import { Settings, Plus } from "lucide-react";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("housekeeping");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [assignee, setAssignee] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/app/dashboard" });
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, email").then(({ data }) => setVolunteers(data ?? []));
  }, []);

  const create = async () => {
    if (!title || !date) return;
    const { error } = await supabase.from("tasks").insert({
      title, type, scheduled_date: date,
      start_time: start || null, assigned_to: assignee || null,
      location: location || null, notes: notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Task created!");
    setTitle(""); setDate(""); setStart(""); setAssignee(""); setLocation(""); setNotes("");
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Settings className="h-6 w-6 text-accent" /> Admin
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Assign tasks and manage the team.</p>
      </header>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Assign a task</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Title (e.g. Clean Riverview room)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{TASK_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} placeholder="Start time" />
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger><SelectValue placeholder="Assign to…" /></SelectTrigger>
            <SelectContent>{volunteers.map((v) => <SelectItem key={v.id} value={v.id}>{v.full_name || v.email}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <Button onClick={create} disabled={!title || !date} className="bg-accent text-accent-foreground hover:bg-accent/90">
          Create task
        </Button>
      </div>

      <div className="rounded-2xl border border-dashed bg-secondary/30 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Volunteers ({volunteers.length})</p>
        <ul className="space-y-1">
          {volunteers.map((v) => <li key={v.id}>{v.full_name || "—"} · {v.email}</li>)}
        </ul>
      </div>
    </div>
  );
}
