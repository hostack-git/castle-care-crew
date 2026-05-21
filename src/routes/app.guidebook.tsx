import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { SOPS } from "@/lib/sops";
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

const INTERACTIVE_SOP_IDS = new Set(["breakfast", "housekeeping", "cottages", "laundry", "checkin"]);

type Playbook = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  content_type: string | null;
  content_text: string | null;
  file_url: string | null;
  order_index: number | null;
  local_sop_id?: string;
};

const LOCAL_PLAYBOOKS: Playbook[] = [
  ...SOPS.filter((sop) => INTERACTIVE_SOP_IDS.has(sop.id)).map((sop, index) => ({
    id: `local-${sop.id}`,
    title: sop.title,
    category: sop.icon === "coffee" ? "Kitchen Operations" : sop.icon === "wrench" ? "Maintenance" : sop.title.replace(" SOP", ""),
    description: sop.subtitle,
    content_type: "local",
    content_text: null,
    file_url: null,
    order_index: index,
    local_sop_id: sop.id,
  })),
  {
    id: "local-checkin",
    title: "Guest Check-In SOP",
    category: "General",
    description: "Guest arrival and key handover",
    content_type: "local",
    content_text: null,
    file_url: null,
    order_index: 99,
    local_sop_id: "checkin",
  },
];

function GuidebookPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Playbook | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await hostackSupabase
          .from("playbooks")
          .select("id, title, category, description, content_type, content_text, file_url, order_index")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .eq("is_archived", false)
          .order("order_index", { ascending: true });
        if (!mounted) return;
        if (error) {
          console.error("Failed to load playbooks", error);
          setPlaybooks(LOCAL_PLAYBOOKS);
        } else {
          const remote = ((data as Playbook[]) ?? []).filter(
            (p) => !LOCAL_PLAYBOOKS.some((local) => local.title === p.title)
          );
          setPlaybooks([...LOCAL_PLAYBOOKS, ...remote]);
        }
      } catch (err) {
        console.error("Failed to load SOPs", err);
        if (mounted) setPlaybooks(LOCAL_PLAYBOOKS);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
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

  const handleClick = (p: Playbook) => {
    if (p.local_sop_id) {
      navigate({ to: "/app/guidebook/sop/$sopId", params: { sopId: p.local_sop_id } });
      return;
    }
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
