import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

export type RoomKind = "room" | "cottage";
export type RoomStatus =
  | "ready"
  | "booked"
  | "checked_in"
  | "needs_cleaning"
  | "cleaning"
  | "maintenance";

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
  status: RoomStatus;
  guest_name: string | null;
  notes: string | null;
  updated_at: string;
};

export const STATUS_META: Record<
  RoomStatus,
  { label: string; dot: string; ring: string; text: string }
> = {
  ready: {
    label: "Ready",
    dot: "bg-emerald-500",
    ring: "ring-emerald-600/30",
    text: "text-emerald-700",
  },
  booked: {
    label: "Booked",
    dot: "bg-blue-500",
    ring: "ring-blue-600/30",
    text: "text-blue-700",
  },
  checked_in: {
    label: "Checked-in",
    dot: "bg-violet-600",
    ring: "ring-violet-700/30",
    text: "text-violet-700",
  },
  needs_cleaning: {
    label: "Needs cleaning",
    dot: "bg-amber-400",
    ring: "ring-amber-600/40",
    text: "text-amber-800",
  },
  cleaning: {
    label: "Cleaning…",
    dot: "bg-orange-500",
    ring: "ring-orange-600/30",
    text: "text-orange-700",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-rose-500",
    ring: "ring-rose-600/30",
    text: "text-rose-700",
  },
};

export const STATUS_ORDER: RoomStatus[] = [
  "ready",
  "booked",
  "checked_in",
  "needs_cleaning",
  "cleaning",
  "maintenance",
];

export function RoomLegend({ rooms }: { rooms: Room[] }) {
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

export function RoomSeat({
  room,
  canEdit,
  size = "md",
  userId,
}: {
  room: Room;
  canEdit: boolean;
  size?: "sm" | "md";
  userId?: string;
}) {
  const m = STATUS_META[room.status];
  const [open, setOpen] = useState(false);
  const dim = size === "sm" ? "h-16 w-16" : "h-20 w-20";

  const update = async (status: RoomStatus) => {
    const { error } = await supabase
      .from("rooms")
      .update({ status, updated_by: userId })
      .eq("id", room.id);
    if (error) toast.error(error.message);
    else setOpen(false);
  };

  const isCottage = room.kind === "cottage";

  const seat = (
    <button
      type="button"
      className={`group relative ${dim} flex flex-col items-center justify-end transition hover:-translate-y-1 focus:outline-none`}
      aria-label={`${room.name} — ${m.label}`}
    >
      <HouseShape status={room.status} variant={isCottage ? "cottage" : "room"} />
      <span className="mt-1 max-w-full truncate text-[10px] font-medium text-foreground/80">
        {room.name}
      </span>
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{seat}</PopoverTrigger>
      <PopoverContent className="w-60 p-3" align="center">
        <p className="font-medium text-sm">{room.name}</p>
        {room.guest_name && (
          <p className="text-xs text-muted-foreground mt-0.5">Guest: {room.guest_name}</p>
        )}
        <p className={`text-xs mt-1 font-medium ${m.text}`}>● {m.label}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Updated {new Date(room.updated_at).toLocaleString()}
        </p>
        {canEdit && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {STATUS_ORDER.map((s) => {
              const sm = STATUS_META[s];
              const active = s === room.status;
              return (
                <button
                  key={s}
                  onClick={() => update(s)}
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

export function RoomSeatGrid({
  title,
  rooms,
  canEdit,
  userId,
  size = "md",
}: {
  title: string;
  rooms: Room[];
  canEdit: boolean;
  userId?: string;
  size?: "sm" | "md";
}) {
  if (rooms.length === 0) return null;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{rooms.length}</span>
      </div>
      <div className="rounded-xl bg-secondary/40 p-5">
        <div className="flex flex-wrap gap-3 justify-center">
          {rooms.map((r) => (
            <RoomSeat key={r.id} room={r} canEdit={canEdit} userId={userId} size={size} />
          ))}
        </div>
      </div>
    </section>
  );
}
