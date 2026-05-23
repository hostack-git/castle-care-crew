import * as XLSX from "xlsx";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";

export interface RoomEntry {
  room: string;
  type: string;
  status: string;
  checkin: boolean;
  checkout: boolean;
  guests: number;
  guest?: string;
}

export interface DailyRoomsData {
  date: string;
  rooms: RoomEntry[];
}

/**
 * Parse an Amenitiz .xlsx export and return structured room data.
 * The parser is tolerant of column name variations — it matches headers
 * case-insensitively and handles common Amenitiz export formats.
 */
export function parseAmenitizXlsx(file: File): Promise<RoomEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (rows.length === 0) throw new Error("No data rows found in file");

        // Normalize header keys
        const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

        const rooms: RoomEntry[] = rows
          .filter((row) => {
            const keys = Object.keys(row);
            return keys.some((k) => norm(k).includes("room") || norm(k).includes("habitaci"));
          })
          .map((row) => {
            const get = (patterns: string[]): string => {
              for (const key of Object.keys(row)) {
                if (patterns.some((p) => norm(key).includes(p))) return String(row[key] ?? "").trim();
              }
              return "";
            };

            const roomName  = get(["room name", "room", "habitaci", "chambre", "camera"]);
            const roomType  = get(["type", "tipo", "category"]);
            const status    = get(["status", "estado", "état", "stato"]);
            const checkinRaw  = get(["check-in", "checkin", "arrival", "llegada", "arrivée", "arrivo"]);
            const checkoutRaw = get(["check-out", "checkout", "departure", "salida", "départ", "partenza"]);
            const guestsRaw   = get(["guest", "pax", "person", "persona"]);

            const isTruthy = (v: string) => /^(yes|sí|si|oui|sì|true|1|x)$/i.test(v.trim());

            return {
              room:    roomName || "Unknown",
              type:    roomType || "",
              status:  status   || "",
              checkin:  isTruthy(checkinRaw),
              checkout: isTruthy(checkoutRaw),
              guests:   parseInt(guestsRaw, 10) || 0,
            };
          })
          .filter((r) => r.room && r.room !== "Unknown");

        resolve(rooms);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/** Upsert parsed rooms data into Supabase for a given date. */
export async function saveRoomsToSupabase(date: string, rooms: RoomEntry[]): Promise<void> {
  const { error } = await hostackSupabase
    .from("daily_rooms")
    .upsert({ property_id: TORRIDONIA_PROPERTY_ID, date, rooms }, { onConflict: "property_id,date" });
  if (error) throw new Error(error.message);
}

/** Load today's rooms from Supabase. Returns null if no data for today. */
export async function loadTodaysRooms(date: string): Promise<RoomEntry[] | null> {
  const { data, error } = await hostackSupabase
    .from("daily_rooms")
    .select("rooms")
    .eq("property_id", TORRIDONIA_PROPERTY_ID)
    .eq("date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data.rooms as RoomEntry[];
}

/** Rooms that need cleaning today (checkouts or rooms changing guests). */
export function roomsToClean(rooms: RoomEntry[]): RoomEntry[] {
  return rooms.filter((r) => r.checkout || r.checkin);
}
