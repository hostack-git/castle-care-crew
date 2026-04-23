import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/announcements")({ component: AnnouncementsPage });

type Ann = { id: string; title: string; content: string; priority: string; created_at: string };

function AnnouncementsPage() {
  const { isAdmin, user } = useAuth();
  const [items, setItems] = useState<Ann[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");

  const load = () =>
    supabase.from("announcements").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as Ann[]) ?? []));

  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!user || !title || !content) return;
    const { error } = await supabase.from("announcements").insert({ title, content, priority, created_by: user.id });
    if (error) return toast.error(error.message);
    toast.success("Posted!");
    setTitle(""); setContent(""); setPriority("normal");
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2"><Megaphone className="h-6 w-6 text-accent" /> Notice board</h1>
        <p className="text-muted-foreground text-sm mt-1">Important updates from the team.</p>
      </header>

      {isAdmin && (
        <div className="rounded-2xl border bg-card p-5 shadow-soft space-y-3">
          <h2 className="font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> New notice</h2>
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Message…" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          <div className="flex items-center justify-between gap-2">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Important</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={post} disabled={!title || !content}>Post</Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {items.map((a) => (
          <article key={a.id} className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-2">
              {a.priority === "high" && <Badge className="bg-accent text-accent-foreground">Important</Badge>}
              <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</p>
            </div>
            <h3 className="font-display text-lg font-semibold">{a.title}</h3>
            <p className="text-sm mt-2 whitespace-pre-line leading-relaxed">{a.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
