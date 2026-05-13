import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Coffee, Home, Wrench, Shirt, Utensils, Sparkles } from "lucide-react";
import { SOPS } from "@/lib/sops";

const SOP_ICONS = {
  coffee: Coffee,
  broom: Sparkles,
  home: Home,
  utensils: Utensils,
  wrench: Wrench,
  shirt: Shirt,
  sparkles: Sparkles,
} as const;

export const Route = createFileRoute("/app/guidebook")({ component: GuidebookPage });

type Section = { id: string; section: string; title: string; content: string; language: string; icon: string | null };

function GuidebookPage() {
  const { t, lang } = useI18n();
  const [sections, setSections] = useState<Section[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    // Try the active language; if no rows exist, fall back to English so content is never blank.
    supabase
      .from("guidebook_sections")
      .select("*")
      .eq("language", lang)
      .order("order_index")
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          setSections(data as Section[]);
          return;
        }
        const { data: fallback } = await supabase
          .from("guidebook_sections")
          .select("*")
          .eq("language", "en")
          .order("order_index");
        setSections((fallback as Section[]) ?? []);
      });
  }, [lang]);

  const filtered = sections.filter((s) =>
    !q || s.title.toLowerCase().includes(q.toLowerCase()) || s.content.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">{t("guide.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("guide.sub")}</p>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("guide.search")} className="pl-9" />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Standard operating procedures</h2>
          <p className="text-sm text-muted-foreground">Step-by-step checklists for each shift.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {SOPS.filter((s) => !q || s.title.toLowerCase().includes(q.toLowerCase()) || s.subtitle.toLowerCase().includes(q.toLowerCase())).map((s) => {
            const Icon = SOP_ICONS[s.icon] ?? Sparkles;
            const total = s.phases.reduce((n, p) => n + p.items.length, 0);
            const cardClass = "group flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft hover:border-primary/40 hover:bg-secondary/30 transition";
            const inner = (
              <></>
            );
            const content = (
              <></>
            );
            const cardBody = (
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{s.title}</p>
                    {s.embedUrl && (
                      <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5">
                        Interactive ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.phases.length} phases · {total} steps
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </section>
      <div className="space-y-4">
        {filtered.map((s) => (
          <article key={s.id} className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl font-semibold">{s.title}</h2>
            <div className="prose prose-sm mt-3 max-w-none whitespace-pre-line text-foreground/85 leading-relaxed">
              {s.content}
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">{t("guide.empty")} "{q}".</p>
        )}
      </div>
    </div>
  );
}
