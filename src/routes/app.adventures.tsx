import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/adventures")({ component: Adventures });

type Adventure = {
  id: string; user_id: string; title: string; description: string | null;
  image_url: string | null; location: string | null; created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
};

function Adventures() {
  const { user } = useAuth();
  const [items, setItems] = useState<Adventure[]>([]);
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    supabase
      .from("adventures")
      .select("*, profiles(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const list = (data as unknown as Adventure[]) ?? [];
        setItems(list);
        // resolve signed URLs
        const map: Record<string, string> = {};
        await Promise.all(
          list.filter((a) => a.image_url).map(async (a) => {
            const { data: signed } = await supabase.storage.from("adventures").createSignedUrl(a.image_url!, 3600);
            if (signed?.signedUrl) map[a.id] = signed.signedUrl;
          })
        );
        setImgs(map);
      });
  };
  useEffect(load, []);

  const submit = async () => {
    if (!user || !title) return;
    setBusy(true);
    try {
      let path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        path = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("adventures").upload(path, file);
        if (error) throw error;
      }
      const { error } = await supabase.from("adventures").insert({
        user_id: user.id, title, description: desc || null, location: location || null, image_url: path,
      });
      if (error) throw error;
      toast.success("Shared with the team!");
      setOpen(false); setTitle(""); setDesc(""); setLocation(""); setFile(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Adventures</h1>
          <p className="text-muted-foreground text-sm mt-1">Trails, swims and discoveries from your days off.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4 mr-1" /> Share</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Share an adventure</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
              <Textarea placeholder="Tell us about it…" value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} />
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button onClick={submit} disabled={busy || !title} className="w-full">{busy ? "Sharing…" : "Share"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {items.map((a) => (
          <article key={a.id} className="rounded-2xl border bg-card overflow-hidden shadow-soft">
            {imgs[a.id] && <img src={imgs[a.id]} alt={a.title} className="w-full h-56 object-cover" loading="lazy" />}
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-lg font-semibold">{a.title}</h3>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">{a.profiles?.full_name || "Volunteer"} · {new Date(a.created_at).toLocaleDateString()}</p>
              {a.location && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</p>}
              {a.description && <p className="text-sm mt-3 leading-relaxed">{a.description}</p>}
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <div className="md:col-span-2 rounded-2xl border border-dashed bg-secondary/30 p-12 text-center text-muted-foreground">
            No adventures yet — be the first to share!
          </div>
        )}
      </div>
    </div>
  );
}
