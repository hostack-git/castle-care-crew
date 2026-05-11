import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Save, Settings2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/templates")({ component: TemplatesPage });

const KIND_LABELS: Record<string, string> = {
  room_clean: "Room cleaning",
  cottage_clean: "Cottage cleaning",
  breakfast: "Breakfast",
  checkin: "Check-in preparation",
  maintenance: "Maintenance",
  deep_clean: "Deep cleaning",
  onboarding: "Onboarding",
};

type Tpl = { id: string; kind: string; items: string[] };

function TemplatesPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tpls, setTpls] = useState<Tpl[]>([]);

  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/app/dashboard" }); }, [loading, isAdmin, navigate]);
  useEffect(() => {
    supabase.from("task_templates").select("id, kind, items").then(({ data }) => setTpls((data as Tpl[]) ?? []));
  }, []);

  if (!isAdmin) return null;

  const update = (id: string, items: string[]) =>
    setTpls((arr) => arr.map((t) => (t.id === id ? { ...t, items } : t)));

  const save = async (t: Tpl) => {
    const items = t.items.map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("task_templates").update({ items }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(`${KIND_LABELS[t.kind] ?? t.kind} saved.`);
  };

  return (
    <div className="space-y-6">
      <Link to="/app/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Link>
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-accent" /> Checklist templates
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Used when generating tasks from the Weekly Rota Builder.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {tpls.map((t) => (
          <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{KIND_LABELS[t.kind] ?? t.kind}</h2>
              <Button size="sm" variant="ghost" onClick={() => update(t.id, [...t.items, ""])}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {t.items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={it} onChange={(e) => update(t.id, t.items.map((x, j) => (j === i ? e.target.value : x)))} />
                  <Button variant="ghost" size="icon" onClick={() => update(t.id, t.items.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => save(t)}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
