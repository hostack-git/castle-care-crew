import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Home, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rooms")({ component: RoomsPage });

type RoomStatus = "clean" | "dirty" | "maintenance" | "occupied";

type Room = {
  id: string;
  name: string;
  type: string | null;
  capacity: number | null;
  status: RoomStatus;
  notes: string | null;
  is_active: boolean;
};

const STATUS_META: Record<RoomStatus, { label: string; dot: string; ring: string; text: string; fill: string }> = {
  clean: {
    label: "Clean",
    dot: "bg-emerald-500",
    ring: "ring-emerald-600/30",
    text: "text-emerald-700",
    fill: "text-emerald-500",
  },
  dirty: {
    label: "Dirty",
    dot: "bg-amber-400",
    ring: "ring-amber-600/40",
    text: "text-amber-800",
    fill: "text-amber-400",
  },
  occupied: {
    label: "Occupied",
    dot: "bg-violet-600",
    ring: "ring-violet-700/30",
    text: "text-violet-700",
    fill: "text-violet-600",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-rose-500",
    ring: "ring-rose-600/30",
    text: "text-rose-700",
    fill: "text-rose-500",
  },
};

const STATUS_ORDER: RoomStatus[] = ["clean", "dirty", "occupied", "maintenance"];

const COTTAGE_HINTS = ["cottage", "lodge", "lochside", "stables", "gardener"];
const isCottage = (r: Room) => {
  const hay = `${r.type ?? ""} ${r.name}`.toLowerCase();
  return COTTAGE_HINTS.some((h) => hay.includes(h));
};

function HouseShape({ status, variant }: { status: RoomStatus; variant: "room" | "cottage" }) {
  const color = STATUS_META[status].fill;
  const stroke = "stroke-foreground/70";
  const door = "fill-foreground/80";
  const win = "fill-background";
  if (variant === "cottage") {
    return (
      <svg viewBox="0 0 64 56" className={`h-12 w-14 drop-shadow-sm ${color}`}>
        <path d="M6 28 L32 8 L58 28 L58 50 L6 50 Z" fill="currentColor" className={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="46" y="12" width="6" height="10" fill="currentColor" className={stroke} strokeWidth="1.2" />
        <rect x="28" y="34" width="8" height="14" className={`${door} stroke-foreground/70`} strokeWidth="1" rx="1" />
        <rect x="14" y="32" width="8" height="8" className={`${win} stroke-foreground/70`} strokeWidth="1" />
        <rect x="42" y="32" width="8" height="8" className={`${win} stroke-foreground/70`} strokeWidth="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 52" className={`h-12 w-11 drop-shadow-sm ${color}`}>
      <path d="M4 24 L24 6 L44 24 L44 46 L4 46 Z" fill="currentColor" className={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="20" y="30" width="8" height="16" className={`${door} stroke-foreground/70`} strokeWidth="1" rx="1" />
      <rect x="9" y="28" width="7" height="7" className={`${win} stroke-foreground/70`} strokeWidth="1" />
      <rect x="32" y="28" width="7" height="7" className={`${win} stroke-foreground/70`} strokeWidth="1" />
    </svg>
  );
}

function RoomLegend({ rooms }: { rooms: Room[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
      {STATUS_ORDER.map((s) => {
        const m = STATUS_META[s];
        const count = rooms.filter((r) => r.status === s).length;
        return (
          <div key={s} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${m.dot} ring-2 ${m.ring}`} />
            <span className="text-foreground/80">{m.label}</span>
            <span className="text-muted-foreground">· {count}</span>
          </div>
        );
      })}
    </div>
  );
}

function RoomSeat({ room, canEdit, onUpdate }: { room: Room; canEdit: boolean; onUpdate: (id: string, status: RoomStatus) => void }) {
  const m = STATUS_META[room.status];
  const [open, setOpen] = useState(false);
  const cottage = isCottage(room);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group relative h-20 w-20 flex flex-col items-center justify-end transition hover:-translate-y-1 focus:outline-none"
          aria-label={`${room.name} — ${m.label}`}
        >
          <HouseShape status={room.status} variant={cottage ? "cottage" : "room"} />
          <span className="mt-1 max-w-full truncate text-[10px] font-medium text-foreground/80">{room.name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <p className="font-medium text-sm">{room.name}</p>
        {(room.type || room.capacity) && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {room.type}
            {room.type && room.capacity ? " · " : ""}
            {room.capacity ? `${room.capacity} pax` : ""}
          </p>
        )}
        <p className={`text-xs mt-1 font-medium ${m.text}`}>● {m.label}</p>
        {room.notes && <p className="text-[11px] text-muted-foreground mt-2">{room.notes}</p>}
        {canEdit && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {STATUS_ORDER.map((s) => {
              const sm = STATUS_META[s];
              const active = s === room.status;
              return (
                <button
                  key={s}
                  onClick={() => {
                    onUpdate(room.id, s);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition ${
                    active ? "border-foreground/40 bg-secondary" : "hover:bg-secondary/60"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${sm.dot}`} />
                  <span className="truncate">{sm.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RoomsPage() {
  const { user, isAdmin, isRoomManager } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const canEdit = Boolean(user) && (isAdmin || isRoomManager);

  useEffect(() => {
    hostackSupabase
      .from("rooms")
      .select("id, name, type, capacity, status, notes, is_active")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setRooms((data as Room[]) ?? []);
        setLoading(false);
      });
  }, []);

  const updateStatus = async (id: string, status: RoomStatus) => {
    const prev = rooms;
    setRooms((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await hostackSupabase.from("rooms").update({ status }).eq("id", id);
    if (error) {
      setRooms(prev);
      toast.error(error.message);
    } else {
      toast.success("Status updated");
    }
  };

  const grouped = useMemo(
    () => ({
      rooms: rooms.filter((r) => !isCottage(r)),
      cottages: rooms.filter((r) => isCottage(r)),
    }),
    [rooms],
  );

  return (
    <div className="space-y-6">
      <Link to="/app/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Home className="h-6 w-6 text-accent" /> Rooms & Cottages
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Live status board {canEdit ? "— tap a room to update." : "— view only."}
        </p>
      </header>

      <div className="rounded-2xl border bg-card/60 p-4">
        <RoomLegend rooms={rooms} />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : rooms.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No rooms configured.</p>
      ) : (
        <div className="space-y-5">
          {grouped.rooms.length > 0 && (
            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-base font-semibold">B&B Rooms</h3>
                <span className="text-xs text-muted-foreground">{grouped.rooms.length}</span>
              </div>
              <div className="rounded-xl bg-secondary/40 p-5">
                <div className="flex flex-wrap gap-5 justify-center">
                  {grouped.rooms.map((r) => (
                    <RoomSeat key={r.id} room={r} canEdit={canEdit} onUpdate={updateStatus} />
                  ))}
                </div>
              </div>
            </section>
          )}
          {grouped.cottages.length > 0 && (
            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-base font-semibold">Cottages</h3>
                <span className="text-xs text-muted-foreground">{grouped.cottages.length}</span>
              </div>
              <div className="rounded-xl bg-secondary/40 p-5">
                <div className="flex flex-wrap gap-5 justify-center">
                  {grouped.cottages.map((r) => (
                    <RoomSeat key={r.id} room={r} canEdit={canEdit} onUpdate={updateStatus} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
