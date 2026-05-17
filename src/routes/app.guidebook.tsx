import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getPublishedPlaybooks } from "@/lib/hostack-admin.functions";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, BookOpen, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/guidebook")({ component: GuidebookPage });

const CATEGORY_ICON: Record<string, string> = {
  housekeeping: "🧹",
  "kitchen operations": "🍳",
  "safety & maintenance": "⚠️",
  maintenance: "🔧",
  general: "📋",
  laundry: "👕",
  cottages: "🏡",
};

type Playbook = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  content_type: string | null;
  content_text: string | null;
  file_url: string | null;
  order_index: number | null;
};

function GuidebookPage() {
  const { t } = useI18n();
  const loadPlaybooks = useServerFn(getPublishedPlaybooks);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Playbook | null>(null);

  useEffect(() => {
    let mounted = true;
    loadPlaybooks()
      .then(({ playbooks }) => {
        if (mounted) setPlaybooks((playbooks as Playbook[]) ?? []);
      })
      .catch((error) => {
        console.error("Failed to load SOPs", error);
        if (mounted) setPlaybooks([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadPlaybooks]);

  const filtered = playbooks.filter((p) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      p.title.toLowerCase().includes(needle) ||
      (p.description ?? "").toLowerCase().includes(needle) ||
      (p.category ?? "").toLowerCase().includes(needle)
    );
  });

  const handleClick = (p: Playbook) => {
    if (p.file_url) {
      window.open(p.file_url, "_blank");
    } else if (p.content_text) {
      setActive(p);
    }
  };

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
            const icon = CATEGORY_ICON[key] ?? "📋";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleClick(p)}
                className="group flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-soft hover:border-primary/40 hover:bg-secondary/30 transition text-left w-full"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0 text-xl">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{p.title}</p>
                    {p.file_url && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                  {p.category && (
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{p.category}</p>
                  )}
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{CATEGORY_ICON[(active.category ?? "").toLowerCase()] ?? "📋"}</span>
                  <SheetTitle>{active.title}</SheetTitle>
                </div>
                {active.category && (
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{active.category}</p>
                )}
              </SheetHeader>
              <div className="prose prose-sm dark:prose-invert max-w-none mt-6">
                <ReactMarkdown>{active.content_text ?? ""}</ReactMarkdown>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
