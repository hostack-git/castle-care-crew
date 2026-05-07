import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BarChart3, CheckCircle2, ListChecks, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/admin/stats")({ component: StatsPage });

type Profile = { id: string; full_name: string | null; email: string | null };
type TaskRow = { id: string; assigned_to: string | null; status: string; type: string };
type ItemRow = { id: string; is_done: boolean; task_id: string };

function StatsPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/app/dashboard" });
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("tasks").select("id, assigned_to, status, type"),
      supabase.from("task_checklist_items").select("id, is_done, task_id"),
    ]).then(([p, t, c]) => {
      setProfiles((p.data as Profile[]) ?? []);
      setTasks((t.data as TaskRow[]) ?? []);
      setItems((c.data as ItemRow[]) ?? []);
      setReady(true);
    });
  }, []);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const stats = useMemo(() => {
    return profiles.map((p) => {
      const myTasks = tasks.filter((t) => t.assigned_to === p.id);
      const completed = myTasks.filter((t) => t.status === "completed").length;
      const inProgress = myTasks.filter((t) => t.status === "in_progress").length;
      const myItems = items.filter((i) => {
        const t = taskById.get(i.task_id);
        return t?.assigned_to === p.id;
      });
      const itemsDone = myItems.filter((i) => i.is_done).length;
      return {
        id: p.id, name: p.full_name || p.email || "—",
        total: myTasks.length, completed, inProgress,
        itemsDone, itemsTotal: myItems.length,
      };
    }).sort((a, b) => b.completed - a.completed);
  }, [profiles, tasks, items, taskById]);

  const totals = useMemo(() => ({
    tasks: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    items: items.length,
    itemsDone: items.filter((i) => i.is_done).length,
    volunteers: profiles.length,
  }), [tasks, items, profiles]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Link to="/app/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-accent" /> Volunteer activity
        </h1>
        <p className="text-muted-foreground text-sm mt-1">How much each volunteer has completed.</p>
      </header>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat icon={<Users className="h-4 w-4" />} label="Volunteers" value={totals.volunteers} />
        <Stat icon={<ListChecks className="h-4 w-4" />} label="Tasks" value={`${totals.completed} / ${totals.tasks}`} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Checklist items" value={`${totals.itemsDone} / ${totals.items}`} />
        <Stat icon={<BarChart3 className="h-4 w-4" />} label="Completion" value={totals.tasks ? `${Math.round((totals.completed / totals.tasks) * 100)}%` : "—"} />
      </div>

      {!ready ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="rounded-2xl border bg-card divide-y">
          {stats.length === 0 && <p className="p-6 text-sm text-muted-foreground">No volunteers yet.</p>}
          {stats.map((s) => {
            const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
            return (
              <div key={s.id} className="p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-medium">{s.name}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary">{s.completed} done</Badge>
                    {s.inProgress > 0 && <Badge variant="outline">{s.inProgress} in progress</Badge>}
                    <Badge variant="outline">{s.itemsDone}/{s.itemsTotal} steps</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={pct} className="flex-1" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <p className="font-display text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
