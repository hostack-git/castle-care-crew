import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID, IS_DEMO } from "@/integrations/hostack/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, CalendarDays, Users2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/announcements")({ component: AnnouncementsPage });

type Ann = {
  id: string; title: string; content: string; priority: string; created_at: string;
  event_date: string | null; expires_at: string | null;
  volunteers_involved: { id: string; name: string }[] | null;
};

const MONTHS_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDayMonth(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

function todayLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AnnouncementsPage() {
  const { isAdmin, user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<Ann[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");
  const [eventDate, setEventDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [involvedVols, setInvolvedVols] = useState<{ id: string; name: string }[]>([]);
  const [allVolunteers, setAllVolunteers] = useState<{ id: string; name: string }[]>([]);
  const [showVolPicker, setShowVolPicker] = useState(false);

  const load = () => {
    let q = hostackSupabase.from("announcements").select("*").order("created_at", { ascending: false });
    if (IS_DEMO) {
      q = q.eq("property_id", TORRIDONIA_PROPERTY_ID);
    } else {
      q = q.or(`property_id.eq.${TORRIDONIA_PROPERTY_ID},property_id.is.null`);
    }
    q.then(({ data }) => {
      const today = todayLocalYmd();
      const filtered = (data as Ann[]).filter((a) => !a.expires_at || a.expires_at >= today);
      setItems(filtered);
    });
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAdmin) return;
    hostackSupabase
      .from("volunteers")
      .select("id, name")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("status", "active")
      .order("name")
      .then(({ data }) => setAllVolunteers((data as { id: string; name: string }[]) ?? []));
  }, [isAdmin]);

  const post = async () => {
    if (!user || !title || !content) return;
    const { error } = await hostackSupabase.from("announcements").insert({
      property_id: TORRIDONIA_PROPERTY_ID,
      title,
      content,
      priority,
      created_by: user.id,
      event_date: eventDate || null,
      expires_at: expiresAt || null,
      volunteers_involved: involvedVols.length ? involvedVols : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Posted!");
    setTitle(""); setContent(""); setPriority("normal");
    setEventDate(""); setExpiresAt(""); setInvolvedVols([]);
    load();
  };

  const toggleVol = (vol: { id: string; name: string }) => {
    setInvolvedVols((prev) =>
      prev.some((v) => v.id === vol.id)
        ? prev.filter((v) => v.id !== vol.id)
        : [...prev, vol]
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2"><Megaphone className="h-6 w-6 text-accent" /> {t("ann.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("ann.sub")}</p>
      </header>

      {isAdmin && (
        <div className="rounded-2xl border bg-card p-5 shadow-soft space-y-3">
          <h2 className="font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> {t("ann.new")}</h2>
          <Input placeholder={t("ann.titleField")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder={t("ann.message")} value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">{t("ann.normal")}</SelectItem>
              <SelectItem value="high">{t("ann.high")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Event date (optional)</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Hide after date (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setShowVolPicker((v) => !v)}
            >
              <Users2 className="h-3.5 w-3.5" /> Select volunteers {involvedVols.length > 0 && `(${involvedVols.length} selected)`} {showVolPicker ? "▲" : "▼"}
            </button>
            {showVolPicker && allVolunteers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allVolunteers.map((vol) => {
                  const selected = involvedVols.some((v) => v.id === vol.id);
                  return (
                    <button
                      key={vol.id}
                      type="button"
                      onClick={() => toggleVol(vol)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${selected ? "bg-accent text-accent-foreground border-accent" : "bg-transparent text-muted-foreground border-border hover:border-accent"}`}
                    >
                      {vol.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={post} disabled={!title || !content}>{t("ann.post")}</Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {items.map((a) => (
          <article key={a.id} className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-2">
              {a.priority === "high" && <Badge className="bg-accent text-accent-foreground">{t("ann.high")}</Badge>}
              {a.event_date && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                  <CalendarDays className="h-3 w-3" />
                  {fmtDayMonth(a.event_date!)}
                </span>
              )}
              <p className="text-xs text-muted-foreground">{fmtDayMonth(a.created_at.slice(0, 10))}</p>
            </div>
            <h3 className="font-display text-lg font-semibold">{a.title}</h3>
            {a.volunteers_involved && a.volunteers_involved.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <Users2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                {a.volunteers_involved.map((v) => (
                  <span key={v.id} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                    {v.name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm mt-2 whitespace-pre-line leading-relaxed">{a.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
