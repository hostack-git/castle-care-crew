import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { hostackSupabase, HOSTACK_SUPABASE_URL } from "@/integrations/hostack/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, MapPin, Heart, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/adventures")({ component: Adventures });

type Adventure = {
  id: string; user_id: string; title: string; description: string | null;
  image_url: string | null; location: string | null; created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
};

const publicUrl = (path: string) =>
  `${HOSTACK_SUPABASE_URL}/storage/v1/object/public/adventures/${path}`;

function Adventures() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<Adventure[]>([]);
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("adventures")
      .select("*, profiles(full_name, avatar_url)")
      .order("created_at", { ascending: false });
    const list = (data as unknown as Adventure[]) ?? [];
    setItems(list);

    if (list.length) {
      const ids = list.map((a) => a.id);
      const { data: ls } = await supabase
        .from("adventure_likes")
        .select("adventure_id, user_id")
        .in("adventure_id", ids);
      const map: Record<string, { count: number; mine: boolean }> = {};
      ids.forEach((id) => (map[id] = { count: 0, mine: false }));
      (ls ?? []).forEach((l: any) => {
        map[l.adventure_id].count += 1;
        if (l.user_id === user?.id) map[l.adventure_id].mine = true;
      });
      setLikes(map);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const reset = () => {
    setTitle(""); setDesc(""); setLocation("");
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null);
  };

  const submit = async () => {
    if (!user || !title) return;
    setBusy(true);
    try {
      let path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        path = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await hostackSupabase.storage.from("adventures").upload(path, file, {
          cacheControl: "3600", upsert: false, contentType: file.type,
        });
        if (error) throw error;
      }
      const { error } = await hostackSupabase.from("adventures").insert({
        user_id: user.id, title, description: desc || null, location: location || null, image_url: path,
      });
      if (error) throw error;
      toast.success("Shared with the team!");
      setOpen(false); reset();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleLike = async (id: string) => {
    if (!user) return;
    const cur = likes[id] ?? { count: 0, mine: false };
    setLikes((m) => ({ ...m, [id]: { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine } }));
    if (cur.mine) {
      await hostackSupabase.from("adventure_likes").delete().eq("adventure_id", id).eq("user_id", user.id);
    } else {
      await hostackSupabase.from("adventure_likes").insert({ adventure_id: id, user_id: user.id });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t("adv.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("adv.sub")}</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-1" /> {t("adv.share")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("adv.shareTitle")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {preview ? (
                <div className="relative rounded-xl overflow-hidden border">
                  <img src={preview} alt="preview" className="w-full max-h-80 object-cover" />
                  <button
                    type="button"
                    onClick={() => onPickFile(null)}
                    className="absolute top-2 right-2 rounded-full bg-background/80 p-1 hover:bg-background"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed py-10 text-muted-foreground hover:bg-secondary/40">
                  <ImagePlus className="h-7 w-7" />
                  <span className="text-sm">Add a photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              <Input placeholder={t("ann.titleField")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              <Input placeholder={t("adv.location")} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} />
              <Textarea placeholder={t("adv.tellUs")} value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={1000} />
              <Button onClick={submit} disabled={busy || !title} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {busy ? t("adv.sharing") : t("adv.share")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="space-y-5">
        {items.map((a) => {
          const l = likes[a.id] ?? { count: 0, mine: false };
          const author = a.profiles?.full_name || "Volunteer";
          const initials = author.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <article key={a.id} className="rounded-2xl border bg-card overflow-hidden shadow-soft">
              <header className="flex items-center gap-3 p-4">
                <Avatar className="h-9 w-9">
                  {a.profiles?.avatar_url && <AvatarImage src={a.profiles.avatar_url} />}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{author}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                    {a.location && <> · <MapPin className="inline h-3 w-3 -mt-0.5" /> {a.location}</>}
                  </p>
                </div>
              </header>
              {a.image_url && (
                <img
                  src={publicUrl(a.image_url)}
                  alt={a.title}
                  className="w-full max-h-[600px] object-cover bg-secondary"
                  loading="lazy"
                />
              )}
              <div className="p-4">
                <button
                  onClick={() => toggleLike(a.id)}
                  className="flex items-center gap-1.5 text-sm text-foreground/80 hover:text-foreground transition mb-2"
                >
                  <Heart className={`h-5 w-5 ${l.mine ? "fill-rose-500 text-rose-500" : ""}`} />
                  <span>{l.count}</span>
                </button>
                <h3 className="font-display text-lg font-semibold leading-tight">{a.title}</h3>
                {a.description && <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap">{a.description}</p>}
              </div>
            </article>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-secondary/30 p-12 text-center text-muted-foreground">
            {t("adv.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
