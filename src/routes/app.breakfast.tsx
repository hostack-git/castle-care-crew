import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, Clock, RotateCcw, Coffee, Lightbulb, AlarmClock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/breakfast")({
  component: BreakfastTasks,
});

interface ChecklistItem {
  id: string;
  text: string;
}

interface Phase {
  id: number;
  time: string;
  title: string;
  items: ChecklistItem[];
}

const PHASES: Phase[] = [
  {
    id: 1,
    time: "7:00 - 8:00 AM",
    title: "Preparation phase",
    items: [
      { id: "1-1", text: "Be in kitchen at 7:00 AM" },
      { id: "1-2", text: "Prepare 10 small clay plates for tomato + mozzarella starter" },
      { id: "1-3", text: "Cut 3 cherry tomatoes in half per plate" },
      { id: "1-4", text: "Add 2 mozzarella slices per plate" },
      { id: "1-5", text: "Prepare 10 deeper clay plates for egg dishes" },
      { id: "1-6", text: "Assemble all 10 egg dishes following recipe" },
      { id: "1-7", text: "Prepare 2 large French presses (6 spoons coffee each)" },
      { id: "1-8", text: "Boil water using kettle and fill presses" },
    ],
  },
  {
    id: 2,
    time: "8:00 - 9:00 AM",
    title: "Guest service",
    items: [
      { id: "2-1", text: "Listen for guests arriving in dining area" },
      { id: "2-2", text: "Greet guests and ask if they want coffee" },
      { id: "2-3", text: "Bring French press to table if yes" },
      { id: "2-4", text: "Point out sugar, cream, and tea at hot water station" },
      { id: "2-5", text: "Cook egg plates in batches (4 or 2 depending on guest flow)" },
      { id: "2-6", text: "Prepare white plates with starter + 1 bolillo + 1 sweet roll (or 2 toast slices)" },
      { id: "2-7", text: "Add cooked egg plate to each white plate" },
      { id: "2-8", text: "Deliver complete plates to guests" },
    ],
  },
  {
    id: 3,
    time: "9:00 - 10:00 AM",
    title: "Kitchen recovery",
    items: [
      { id: "3-1", text: "Collect used plates with wooden tray" },
      { id: "3-2", text: "Transfer leftovers (milk, juice, coffee, unused prep) to volunteer kitchen" },
      { id: "3-3", text: "Bring all dishes to B&B kitchen" },
      { id: "3-4", text: "Turn on hot water tap and plug drain" },
      { id: "3-5", text: "Fill sink with hot water and dish soap" },
      { id: "3-6", text: "Wash all plates and utensils" },
    ],
  },
  {
    id: 4,
    time: "After 10:00 AM",
    title: "Handover",
    items: [
      { id: "4-1", text: "Empty trash bins" },
      { id: "4-2", text: "Wipe down all surfaces and tables" },
      { id: "4-3", text: "Sweep/mop floor" },
      { id: "4-4", text: "Confirm kitchen is ready for volunteer use" },
    ],
  },
];

const TOTAL = PHASES.reduce((s, p) => s + p.items.length, 0);
const STORAGE_KEY = "torridonia_breakfast_progress";
const EXPANDED_KEY = "torridonia_breakfast_expanded";

function BreakfastTasks() {
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
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked, loaded]);

  useEffect(() => {
    if (loaded) localStorage.setItem(EXPANDED_KEY, JSON.stringify(expanded));
  }, [expanded, loaded]);

  const completedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  );
  const percent = Math.round((completedCount / TOTAL) * 100);

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const togglePhase = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const reset = () => {
    if (confirm("Reset all breakfast progress?")) setChecked({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Coffee className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-semibold">Breakfast SOP</h1>
          <p className="text-sm text-muted-foreground">Daily breakfast service checklist</p>
        </div>
      </div>

      {/* Sticky progress header */}
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
        {PHASES.map((phase) => {
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
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {phase.time}
                  </p>
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
                className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-3 border-t pt-4">
                    {phase.id === 1 && (
                      <RecipeCard title="Egg dish assembly (per plate)">
                        <li>5 drops olive oil at bottom</li>
                        <li>Layer of baby spinach from guest fridge</li>
                        <li>4 cubes of feta cheese on top</li>
                        <li>1 tablespoon chorizo spread around</li>
                        <li>Pour beaten eggs (22–24 eggs total in jug for 10 plates)</li>
                        <li>Sprinkle Italian seasoning to cover surface</li>
                      </RecipeCard>
                    )}

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

                    {phase.id === 1 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Dietary adaptations:</strong> Vegetarian = remove chorizo. Vegan = notify at check-in that breakfast is not adapted.
                        </AlertDescription>
                      </Alert>
                    )}

                    {phase.id === 2 && (
                      <>
                        <RecipeCard title="Microwave cooking process">
                          <li>Standard batch (4 plates): 5 min max power → stir → 2 min more</li>
                          <li>Quick batch (2 plates): 3 min max power → stir → 1 min more</li>
                          <li>Eggs should puff up slightly when ready</li>
                        </RecipeCard>
                        <Alert>
                          <Lightbulb className="h-4 w-4" />
                          <AlertDescription>
                            Use 4-plate batches during peak service (8:15–8:45 AM). Use 2-plate batches for staggered arrivals or late guests.
                          </AlertDescription>
                        </Alert>
                      </>
                    )}

                    {phase.id === 3 && (
                      <Alert>
                        <AlarmClock className="h-4 w-4" />
                        <AlertDescription>
                          Complete dish washing by 10:00 AM so kitchen is free for volunteer shift start.
                        </AlertDescription>
                      </Alert>
                    )}
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

function RecipeCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
      <p className="font-medium mb-2 text-sm">{title}</p>
      <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">{children}</ul>
    </div>
  );
}
