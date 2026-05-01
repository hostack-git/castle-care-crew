import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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
