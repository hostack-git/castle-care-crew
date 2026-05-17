import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Search, Coffee, Home, Wrench, Shirt, Utensils, Sparkles, BookOpen, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/guidebook")({ component: GuidebookPage });

const ICON_MAP: Record<string, typeof Coffee> = {
  breakfast: Coffee,
  housekeeping: Sparkles,
  cottages: Home,
  laundry: Shirt,
  dinner: Utensils,
  maintenance: Wrench,
  general: BookOpen,
};

type Playbook = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  external_url: string | null;
};

function GuidebookPage() {
  const { t } = useI18n();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    hostackSupabase
      .from("playbooks")
      .select("id, title, category, description, external_url")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("is_archived", false)
      .order("category")
      .order("order_index")
      .then(({ data }) => {
        setPlaybooks((data as Playbook[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = playbooks.filter((p) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      p.title.toLowerCase().includes(needle) ||
      (p.description ?? "").toLowerCase().includes(needle) ||
      (p.category ?? "").toLowerCase().includes(needle)
    );
  });

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

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <p className="font-medium">Sin guías disponibles</p>
          <p className="text-sm text-muted-foreground mt-1">
            {q ? `No matches for "${q}"` : "No SOPs published yet."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const key = (p.category ?? "").toLowerCase();
            const Icon = ICON_MAP[key] ?? Sparkles;
            const hasUrl = Boolean(p.external_url);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (p.external_url) window.open(p.external_url, "_blank");
                }}
                className="group flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-soft hover:border-primary/40 hover:bg-secondary/30 transition text-left w-full"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{p.title}</p>
                    {hasUrl && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{p.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
