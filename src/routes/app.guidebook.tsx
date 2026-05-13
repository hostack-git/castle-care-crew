import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Coffee, Home, Wrench, Shirt, Utensils, Sparkles, BookOpen } from "lucide-react";

export const Route = createFileRoute("/app/guidebook")({ component: GuidebookPage });

const URL_MAP: Record<string, string> = {
  breakfast: "https://jorgeibanezhostack.github.io/sopbreakfasttorridonia/breakfast-sop-en.html",
  housekeeping: "https://jorgeibanezhostack.github.io/sopbreakfasttorridonia/housekeeping-sop-en.html",
  cottages: "https://jorgeibanezhostack.github.io/sopbreakfasttorridonia/cottages-sop-en.html",
  laundry: "https://jorgeibanezhostack.github.io/sopbreakfasttorridonia/laundry-sop-en.html",
};

const ICON_MAP: Record<string, typeof Coffee> = {
  breakfast: Coffee,
  housekeeping: Sparkles,
  cottages: Home,
  laundry: Shirt,
  dinner: Utensils,
  maintenance: Wrench,
};

type Playbook = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  content: string | null;
  role_tags: string[] | null;
};

function GuidebookPage() {
  const { t } = useI18n();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    hostackSupabase
      .from("playbooks")
      .select("id, title, category, description, content, role_tags")
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

  const opened = openId ? playbooks.find((p) => p.id === openId) ?? null : null;

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
            {q ? `No matches for "${q}"` : "No playbooks have been published yet."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const key = (p.category ?? "").toLowerCase();
            const Icon = ICON_MAP[key] ?? Sparkles;
            const externalUrl = URL_MAP[key];
            const isExternal = Boolean(externalUrl);
            const cardClasses =
              "group flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft hover:border-primary/40 hover:bg-secondary/30 transition text-left w-full";
            const inner = (
              <>
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{p.title}</p>
                    {isExternal && (
                      <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5">
                        Interactive ✓
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </>
            );
            return isExternal ? (
              <button
                key={p.id}
                type="button"
                onClick={() => window.open(externalUrl, "_blank")}
                className={cardClasses}
              >
                {inner}
              </button>
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenId(p.id)}
                className={cardClasses}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}

      {opened && (
        <article className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{opened.category}</p>
              <h2 className="font-display text-xl font-semibold mt-1">{opened.title}</h2>
            </div>
            <button
              onClick={() => setOpenId(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="prose prose-sm mt-4 max-w-none whitespace-pre-line text-foreground/85 leading-relaxed">
            {opened.content || opened.description || "No content yet."}
          </div>
        </article>
      )}
    </div>
  );
}
