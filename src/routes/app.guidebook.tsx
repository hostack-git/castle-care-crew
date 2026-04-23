import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LANGUAGES, type LanguageCode } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/app/guidebook")({ component: GuidebookPage });

type Section = { id: string; section: string; title: string; content: string; language: LanguageCode; icon: string | null };

function GuidebookPage() {
  const { profile } = useAuth();
  const [lang, setLang] = useState<LanguageCode>(profile?.language ?? "en");
  const [sections, setSections] = useState<Section[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("guidebook_sections").select("*").eq("language", lang).order("order_index")
      .then(({ data }) => setSections((data as Section[]) ?? []));
  }, [lang]);

  const filtered = sections.filter((s) =>
    !q || s.title.toLowerCase().includes(q.toLowerCase()) || s.content.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">House guidebook</h1>
          <p className="text-muted-foreground text-sm mt-1">Everything you need to know about Torridon House.</p>
        </div>
        <Select value={lang} onValueChange={(v) => setLang(v as LanguageCode)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guidebook…" className="pl-9" />
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
          <p className="text-center text-muted-foreground py-12">No sections match "{q}".</p>
        )}
      </div>
    </div>
  );
}
