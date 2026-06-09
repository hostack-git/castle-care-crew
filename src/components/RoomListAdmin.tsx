import { useEffect, useState } from "react";
import { saveRoomsToSupabase, loadTodaysRooms, type RoomEntry } from "@/lib/amenitiz-parser";
import { importRoomsFromSheets, tabNameForDate, startOfWeekMondayUTC } from "@/lib/rota-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Home, TreePine, Save, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const today = () => new Date().toISOString().split("T")[0];

function linesToRooms(lines: string, type: string): RoomEntry[] {
  return lines
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((room) => ({ room, type, status: "needs_cleaning", checkout: true, checkin: false, guests: 0 }));
}

function roomsToLines(rooms: RoomEntry[], type: string): string {
  return rooms
    .filter((r) => r.type === type)
    .map((r) => r.room)
    .join("\n");
}

function statusBadge(r: RoomEntry) {
  if (r.checkin) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Check In</Badge>;
  if (r.checkout) return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">To Clean</Badge>;
  if (r.status === "occupied") return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Staying</Badge>;
  return <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Free</Badge>;
}

export function RoomListAdmin() {
  const [savedRooms, setSavedRooms] = useState<RoomEntry[]>([]);
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [housekeepingRooms, setHousekeepingRooms] = useState("");
  const [cottageRooms, setCottageRooms] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const date = today();
    loadTodaysRooms(date)
      .then((rooms) => {
        if (!rooms) return;
        setSavedRooms(rooms);
        setSavedDate(date);
        setHousekeepingRooms(roomsToLines(rooms, "housekeeping"));
        setCottageRooms(roomsToLines(rooms, "cottages"));
      })
      .catch(() => {});
  }, []);

  const syncFromRota = async () => {
    setSyncing(true);
    setSyncErrors([]);
    try {
      const date = today();
      const monCurrent = startOfWeekMondayUTC(new Date());
      const tab = tabNameForDate(monCurrent);
      const { rooms, errors } = await importRoomsFromSheets(tab, date);

      if (rooms.length === 0) {
        toast.error("No rooms found in Rota sheet — check that the tab exists and room names match.");
        setSyncErrors(errors);
        return;
      }

      await saveRoomsToSupabase(date, rooms);
      setSavedRooms(rooms);
      setSavedDate(date);
      setHousekeepingRooms(roomsToLines(rooms, "housekeeping"));
      setCottageRooms(roomsToLines(rooms, "cottages"));
      setSyncErrors(errors);
      if (errors.length > 0) {
        toast.warning(`Synced ${rooms.length} rooms (${errors.length} room(s) not found in sheet)`);
      } else {
        toast.success(`Synced ${rooms.length} rooms from Rota for ${date}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const saveManual = async () => {
    setSaving(true);
    try {
      const date = today();
      const allRooms: RoomEntry[] = [
        ...linesToRooms(housekeepingRooms, "housekeeping"),
        ...linesToRooms(cottageRooms, "cottages"),
      ];
      await saveRoomsToSupabase(date, allRooms);
      setSavedRooms(allRooms);
      setSavedDate(date);
      toast.success(`Rooms saved for ${date}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const bbRooms = savedRooms.filter((r) => r.type === "housekeeping");
  const cottages = savedRooms.filter((r) => r.type === "cottages");

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Today's rooms to clean</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Synced automatically from the Rota sheet every morning.
            {savedDate && <span className="ml-2 text-emerald-600 font-medium">Last synced: {savedDate}</span>}
          </p>
        </div>
        <Button onClick={syncFromRota} disabled={syncing} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from Rota"}
        </Button>
      </div>

      {syncErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> {syncErrors.length} room(s) not found in sheet:
          </p>
          {syncErrors.map((e, i) => (
            <p key={i} className="text-xs text-amber-600 pl-4">{e}</p>
          ))}
        </div>
      )}

      {savedRooms.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Home className="h-4 w-4 text-emerald-600" /> B&B Rooms
            </p>
            <div className="rounded-lg border bg-card divide-y text-sm">
              {bbRooms.length === 0 && (
                <p className="px-3 py-2 text-muted-foreground text-xs">No B&B rooms</p>
              )}
              {bbRooms.map((r) => (
                <div key={r.room} className="flex items-center justify-between px-3 py-2">
                  <span>{r.room}</span>
                  {statusBadge(r)}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <TreePine className="h-4 w-4 text-teal-600" /> Cottages
            </p>
            <div className="rounded-lg border bg-card divide-y text-sm">
              {cottages.length === 0 && (
                <p className="px-3 py-2 text-muted-foreground text-xs">No cottages</p>
              )}
              {cottages.map((r) => (
                <div key={r.room} className="flex items-center justify-between px-3 py-2">
                  <span>{r.room}</span>
                  {statusBadge(r)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {savedRooms.length === 0 && !syncing && (
        <p className="text-sm text-muted-foreground italic">
          No room data for today yet. Click "Sync from Rota" to load.
        </p>
      )}

      {/* Manual override (collapsed by default) */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {showManual ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Manual override
        </button>

        {showManual && (
          <div className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Enter one room per line. This overwrites today's data.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Home className="h-4 w-4 text-emerald-600" /> Housekeeping rooms
                </label>
                <Textarea
                  value={housekeepingRooms}
                  onChange={(e) => setHousekeepingRooms(e.target.value)}
                  placeholder={"Suite\nEast 1\nEast 2"}
                  rows={6}
                  className="resize-none font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <TreePine className="h-4 w-4 text-teal-600" /> Cottages
                </label>
                <Textarea
                  value={cottageRooms}
                  onChange={(e) => setCottageRooms(e.target.value)}
                  placeholder={"Lochside\nCorry"}
                  rows={6}
                  className="resize-none font-mono text-sm"
                />
              </div>
            </div>
            <Button onClick={saveManual} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save manually"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
