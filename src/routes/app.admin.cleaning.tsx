import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Save, ArrowLeft, Plus, Trash2, Home, TreePine } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/cleaning")({ component: CleaningMatrixPage });

type PropertyRoom = { id: string; name: string; type: string; sort_order: number };

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CleaningMatrixPage() {
  const { isAdmin, loading } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [grid, setGrid] = useState<Record<string, Record<string, boolean>>>({});
  const [originalGrid, setOriginalGrid] = useState<Record<string, Record<string, boolean>>>({});
  const [scheduleIds, setScheduleIds] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"room" | "cottage">("room");
  const [addingRoom, setAddingRoom] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const startStr = ymd(days[0]);
  const endStr = ymd(days[6]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [{ data: roomData }, { data: schedData }] = await Promise.all([
        hostackSupabase
          .from("property_rooms")
          .select("id, name, type, sort_order")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        hostackSupabase
          .from("cleaning_schedule")
          .select("id, room_id, clean_date")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .gte("clean_date", startStr)
          .lte("clean_date", endStr),
      ]);

      const roomList = (roomData as PropertyRoom[]) ?? [];
      const g: Record<string, Record<string, boolean>> = {};
      const ids: Record<string, string> = {};
      for (const r of roomList) g[r.id] = {};
      for (const s of (schedData ?? []) as { id: string; room_id: string; clean_date: string }[]) {
        if (!g[s.room_id]) g[s.room_id] = {};
        g[s.room_id][s.clean_date] = true;
        ids[`${s.room_id}_${s.clean_date}`] = s.id;
      }

      setRooms(roomList);
      setGrid(g);
      setOriginalGrid(JSON.parse(JSON.stringify(g)));
      setScheduleIds(ids);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadData(); }, [startStr, endStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCell = (roomId: string, date: string) => {
    setGrid((prev) => ({
      ...prev,
      [roomId]: { ...(prev[roomId] ?? {}), [date]: !prev[roomId]?.[date] },
    }));
  };

  const onSave = async () => {
    setBusy(true);
    try {
      const toInsert: Record<string, unknown>[] = [];
      const toDelete: string[] = [];

      for (const room of rooms) {
        for (const d of days) {
          const date = ymd(d);
          const next = grid[room.id]?.[date] ?? false;
          const prev = originalGrid[room.id]?.[date] ?? false;
          if (next === prev) continue;
          const existingId = scheduleIds[`${room.id}_${date}`];
          if (!next && existingId) {
            toDelete.push(existingId);
          } else if (next) {
            toInsert.push({ property_id: TORRIDONIA_PROPERTY_ID, room_id: room.id, clean_date: date });
          }
        }
      }

      if (toDelete.length > 0) await hostackSupabase.from("cleaning_schedule").delete().in("id", toDelete);
      if (toInsert.length > 0) await hostackSupabase.from("cleaning_schedule").insert(toInsert);

      toast.success(`Saved — ${toInsert.length} added, ${toDelete.length} removed`);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const addRoom = async () => {
    if (!newRoomName.trim()) return;
    setAddingRoom(true);
    try {
      const { error } = await hostackSupabase.from("property_rooms").insert({
        property_id: TORRIDONIA_PROPERTY_ID,
        name: newRoomName.trim(),
        type: newRoomType,
        sort_order: rooms.filter((r) => r.type === newRoomType).length,
      });
      if (error) toast.error(error.message);
      else {
        setNewRoomName("");
        toast.success(`${newRoomName.trim()} added`);
        await loadData();
      }
    } finally {
      setAddingRoom(false);
    }
  };

  const deleteRoom = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"? All cleaning entries for this room will also be deleted.`)) return;
    await hostackSupabase.from("cleaning_schedule").delete().eq("room_id", id).eq("property_id", TORRIDONIA_PROPERTY_ID);
    const { error } = await hostackSupabase.from("property_rooms").delete().eq("id", id).eq("property_id", TORRIDONIA_PROPERTY_ID);
    if (error) toast.error(error.message);
    else { toast.success(`${name} removed`); await loadData(); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <p className="text-sm">Admin only</p>;

  const today = todayYmd();
  const bbRooms = rooms.filter((r) => r.type === "room");
  const cottages = rooms.filter((r) => r.type === "cottage");

  const RoomGroupRows = ({ label, groupRooms, icon }: { label: string; groupRooms: PropertyRoom[]; icon: React.ReactNode }) => {
    if (groupRooms.length === 0) return null;
    return (
      <>
        <tr>
          <td
            colSpan={8}
            className="px-3 py-1.5 bg-muted/30 border-b border-t text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            <span className="flex items-center gap-1.5">{icon} {label}</span>
          </td>
        </tr>
        {groupRooms.map((room) => {
          const isCleanType = room.type === "cottage";
          return (
            <tr key={room.id} className="border-b last:border-0 hover:bg-muted/5">
              <td className="px-3 py-2 sticky left-0 bg-card z-10 border-r">
                <div className="flex items-center justify-between gap-2 min-w-[160px]">
                  <span className="font-medium text-sm">{room.name}</span>
                  <button
                    type="button"
                    onClick={() => deleteRoom(room.id, room.name)}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded transition shrink-0"
                    title={`Remove ${room.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
              {days.map((d) => {
                const date = ymd(d);
                const checked = grid[room.id]?.[date] ?? false;
                const isToday = date === today;
                return (
                  <td key={date} className={`p-2 align-middle border-l text-center ${isToday ? "bg-primary/5" : ""}`}>
                    <button
                      type="button"
                      onClick={() => toggleCell(room.id, date)}
                      className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto transition text-base
                        ${checked
                          ? isCleanType
                            ? "bg-teal-500 border-teal-600 text-white"
                            : "bg-emerald-500 border-emerald-600 text-white"
                          : "bg-transparent border-dashed border-muted-foreground/30 text-transparent hover:border-muted-foreground/60"
                        }`}
                      title={`${room.name} — ${date}`}
                    >
                      ✓
                    </button>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/admin">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Admin
            </Button>
          </Link>
          <h1 className="font-display text-2xl font-semibold">Cleaning Schedule</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))} className="gap-1">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground hidden sm:inline">{startStr} → {endStr}</span>
          <Button onClick={onSave} disabled={busy} className="gap-2">
            <Save className="h-4 w-4" />
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Add room */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="font-medium text-sm">Add a room or cottage</h3>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input
              placeholder="e.g. Room 7 or Glenmore Cottage"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRoom()}
              className="w-60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              value={newRoomType}
              onChange={(e) => setNewRoomType(e.target.value as "room" | "cottage")}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="room">B&amp;B Room (Housekeeping)</option>
              <option value="cottage">Cottage</option>
            </select>
          </div>
          <Button onClick={addRoom} disabled={addingRoom || !newRoomName.trim()} className="gap-1 self-end">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          B&amp;B Rooms appear to volunteers on <strong>Housekeeping</strong> shifts · Cottages appear to volunteers on <strong>Cottages</strong> shifts
        </p>
      </div>

      {/* Matrix */}
      {loadingData ? (
        <div className="h-32 rounded-2xl bg-secondary/40 animate-pulse" />
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-secondary/20 p-10 text-center text-sm text-muted-foreground space-y-2">
          <Home className="h-8 w-8 mx-auto opacity-30" />
          <p>No rooms added yet. Use the form above to add your first room.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-3 py-2 sticky left-0 bg-muted/40 z-10 min-w-[200px] border-b border-r font-medium">
                  Room
                </th>
                {days.map((d) => {
                  const dateStr = ymd(d);
                  const isToday = dateStr === today;
                  return (
                    <th
                      key={dateStr}
                      className={`px-2 py-2 text-center font-medium border-b border-l min-w-[52px] ${isToday ? "bg-primary/10" : ""}`}
                    >
                      <div className="flex flex-col items-center text-xs leading-tight">
                        <span className="text-muted-foreground">{DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
                        <span className={isToday ? "text-primary font-bold" : ""}>{d.getDate()}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <RoomGroupRows label="B&B Rooms" groupRooms={bbRooms} icon={<Home className="h-3.5 w-3.5" />} />
              <RoomGroupRows label="Cottages" groupRooms={cottages} icon={<TreePine className="h-3.5 w-3.5" />} />
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {rooms.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-emerald-500 inline-block" /> B&amp;B Room scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-teal-500 inline-block" /> Cottage scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded border-2 border-dashed border-muted-foreground/40 inline-block" /> Not scheduled
          </span>
        </div>
      )}
    </div>
  );
}
