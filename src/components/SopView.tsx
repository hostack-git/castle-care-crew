import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronDown,
  Clock,
  RotateCcw,
  Coffee,
  Home,
  Wrench,
  Shirt,
  Utensils,
  Sparkles,
  Lightbulb,
  AlarmClock,
  AlertTriangle,
} from "lucide-react";
import type { Sop, SopExtra } from "@/lib/sops";

const ICONS = {
  coffee: Coffee,
  broom: Sparkles,
  home: Home,
  utensils: Utensils,
  wrench: Wrench,
  shirt: Shirt,
  sparkles: Sparkles,
} as const;

export function SopView({ sop }: { sop: Sop }) {
  const TOTAL = useMemo(() => sop.phases.reduce((s, p) => s + p.items.length, 0), [sop]);
  const STORAGE_KEY = `torridonia_sop_progress_${sop.id}`;
  const EXPANDED_KEY = `torridonia_sop_expanded_${sop.id}`;

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: true });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem(STORAGE_KEY);
      const e = localStorage.getItem(EXPANDED_KEY);
      if (c) setChecked(JSON.parse(c));
      if (e) setExpanded(JSON.parse(e));
    } catch {}
    setLoaded(true);
  }, [STORAGE_KEY, EXPANDED_KEY]);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked, loaded, STORAGE_KEY]);

  useEffect(() => {
    if (loaded) localStorage.setItem(EXPANDED_KEY, JSON.stringify(expanded));
  }, [expanded, loaded, EXPANDED_KEY]);

  const completedCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const percent = TOTAL === 0 ? 0 : Math.round((completedCount / TOTAL) * 100);

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }));
  const togglePhase = (id: number) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const reset = () => {
    if (confirm(`Reset progress for ${sop.title}?`)) setChecked({});
  };

  const Icon = ICONS[sop.icon] ?? Sparkles;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Icon className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-semibold">{sop.title}</h1>
          <p className="text-sm text-muted-foreground">{sop.subtitle}</p>
        </div>
      </div>

      <div className="sticky top-0 lg:top-0 z-10 -mx-6 lg:-mx-10 px-6 lg:px-10 py-3 bg-cream-paper/95 backdrop-blur border-b">
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-sm font-medium">
            {completedCount}/{TOTAL} tasks
          </span>
          <Button variant="ghost" size="sm" onClick={reset} className="h-8">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        </div>
        <Progress value={percent} />
      </div>

      <div className="space-y-4">
        {sop.phases.map((phase) => {
          const isOpen = !!expanded[phase.id];
          const phaseDone = phase.items.filter((i) => checked[i.id]).length;
          return (
            <Card key={phase.id} className="overflow-hidden">
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/40 transition min-h-[56px]"
              >
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{phase.time}</p>
                  <p className="font-medium">
                    Phase {phase.id} — {phase.title}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {phaseDone}/{phase.items.length}
                </span>
                <ChevronDown
                  className={`h-5 w-5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-3 border-t pt-4">
                    {phase.before?.map((x, i) => <Extra key={`b-${i}`} extra={x} />)}

                    <ul className="space-y-1">
                      {phase.items.map((item) => {
                        const done = !!checked[item.id];
                        return (
                          <li key={item.id}>
                            <label
                              className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-secondary/40 transition min-h-[44px]"
                              onClick={(e) => {
                                e.preventDefault();
                                toggle(item.id);
                              }}
                            >
                              <Checkbox checked={done} className="mt-0.5" />
                              <span
                                className={`text-sm flex-1 ${done ? "line-through text-muted-foreground" : ""}`}
                              >
                                {item.text}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>

                    {phase.after?.map((x, i) => <Extra key={`a-${i}`} extra={x} />)}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Extra({ extra }: { extra: SopExtra }) {
  if (extra.kind === "recipe") {
    return (
      <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
        <p className="font-medium mb-2 text-sm">{extra.title}</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {extra.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
    );
  }
  const Icon = extra.variant === "warn" ? AlertTriangle : extra.variant === "time" ? AlarmClock : Lightbulb;
  return (
    <Alert>
      <Icon className="h-4 w-4" />
      <AlertDescription>
        {extra.title && <strong>{extra.title}: </strong>}
        {extra.text}
      </AlertDescription>
    </Alert>
  );
}
