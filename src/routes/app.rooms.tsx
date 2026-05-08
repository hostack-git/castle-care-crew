import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bed, Home, Plus, ShieldCheck, Trash2, Users, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rooms")({ component: RoomsPage });

type RoomKind = "room" | "cottage";
type RoomStatus = "ready" | "booked" | "checked_in" | "needs_cleaning" | "cleaning" | "maintenance";
type Room = {
  id: string; name: string; kind: RoomKind; status: RoomStatus;
  guest_name: string | null; notes: string | null; updated_at: string; updated_by: string | null;
};

const STATUSES: { value: RoomStatus; label: string; cls: string }[] = [
  { value: "ready", label: "Ready", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "booked", label: "Booked", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "checked_in", label: "Checked-in", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  { value: "needs_cleaning", label: "Needs cleaning", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  { value: "cleaning", label: "Cleaning…", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "maintenance", label: "Maintenance", cls: "bg-rose-100 text-rose-800 border-rose-200" },
];
const statusMeta = (s: RoomStatus) => STATUSES.find((x) => x.value === s)!;

function RoomsPage() {
  const { user, isAdmin, isRoomManager } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const canEdit = isAdmin || isRoomManager;

  useEffect(() => {
    supabase.from("rooms").select("*").order("kind").order("name").then(({ data }) => {
      setRooms((data as Room[]) ?? []);
      setLoading(false);
    });

    const ch = supabase
      .channel("rooms-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, (payload) => {
        setRooms((cur) => {
          if (payload.eventType === "INSERT") return [...cur, payload.new as Room];
          if (payload.eventType === "DELETE") return cur.filter((r) => r.id !== (payload.old as Room).id);
          return cur.map((r) => (r.id === (payload.new as Room).id ? (payload.new as Room) : r));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, status: RoomStatus) => {
    const { error } = await supabase.from("rooms").update({ status, updated_by: user?.id }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this room?")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const grouped = useMemo(() => ({
    rooms: rooms.filter((r) => r.kind === "room"),
    cottages: rooms.filter((r) => r.kind === "cottage"),
  }), [rooms]);

  return (
    <div className="space-y-6">
      <Link to="/app/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Link>

      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <Home className="h-6 w-6 text-accent" /> Rooms & Cottages
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live status board {canEdit ? "— tap a status to update." : "— view only."}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <ManagePermissionsDialog />}
          {isAdmin && <NewRoomDialog />}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Badge key={s.value} variant="outline" className={`${s.cls} border`}>
            {s.label} · {rooms.filter((r) => r.status === s.value).length}
          </Badge>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="space-y-8">
          {(["rooms", "cottages"] as const).map((g) => (
            <section key={g}>
              <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2">
                {g === "rooms" ? <Bed className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                {g === "rooms" ? "B&B Rooms" : "Cottages"} ({grouped[g].length})
              </h2>
              {grouped[g].length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped[g].map((r) => {
                    const m = statusMeta(r.status);
                    return (
                      <article key={r.id} className="rounded-2xl border bg-card p-4 shadow-soft space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-medium truncate">{r.name}</h3>
                            {r.guest_name && <p className="text-xs text-muted-foreground truncate">Guest: {r.guest_name}</p>}
                          </div>
                          {isAdmin && (
                            <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <Badge variant="outline" className={`${m.cls} border w-full justify-center py-1`}>{m.label}</Badge>
                        {canEdit ? (
                          <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as RoomStatus)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <p className="text-[10px] text-muted-foreground">
                          Updated {new Date(r.updated_at).toLocaleString()}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function NewRoomDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RoomKind>("room");
  const submit = async () => {
    if (!name) return;
    const { error } = await supabase.from("rooms").insert({ name, kind });
    if (error) return toast.error(error.message);
    setName(""); setOpen(false); toast.success("Added");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"><Plus className="h-4 w-4" /> Add</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a room or cottage</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name (e.g. Riverview Room)" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={kind} onValueChange={(v) => setKind(v as RoomKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="room">B&B Room</SelectItem>
              <SelectItem value="cottage">Cottage</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={submit} disabled={!name} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManagePermissionsDialog() {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<{ id: string; full_name: string | null; email: string | null; isManager: boolean; isAdmin: boolean }[]>([]);

  const load = async () => {
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const map = new Map<string, { admin: boolean; mgr: boolean }>();
    (roles ?? []).forEach((r: any) => {
      const cur = map.get(r.user_id) ?? { admin: false, mgr: false };
      if (r.role === "admin") cur.admin = true;
      if (r.role === "room_manager") cur.mgr = true;
      map.set(r.user_id, cur);
    });
    setPeople((profs ?? []).map((p: any) => {
      const m = map.get(p.id) ?? { admin: false, mgr: false };
      return { ...p, isManager: m.mgr, isAdmin: m.admin };
    }));
  };

  useEffect(() => { if (open) load(); }, [open]);

  const toggle = async (uid: string, isManager: boolean) => {
    if (isManager) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "room_manager");
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "room_manager" });
      if (error) return toast.error(error.message);
    }
    load();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><ShieldCheck className="h-4 w-4" /> Permissions</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Who can update rooms</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Admins always can. Toggle Room Manager to grant access to other staff.</p>
        <div className="divide-y border rounded-lg max-h-80 overflow-auto">
          {people.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{p.email}</p>
              </div>
              {p.isAdmin ? (
                <Badge>Admin</Badge>
              ) : (
                <Button size="sm" variant={p.isManager ? "default" : "outline"} onClick={() => toggle(p.id, p.isManager)}>
                  {p.isManager ? "Room Manager ✓" : "Grant access"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
