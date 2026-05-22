import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { parseAmenitizXlsx, saveRoomsToSupabase, type RoomEntry } from "@/lib/amenitiz-parser";
import { toast } from "sonner";
import { Upload, LogIn, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AmenitizUpload({ onImported }: { onImported?: (rooms: RoomEntry[]) => void }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<RoomEntry[] | null>(null);
  const [dragging, setDragging] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please upload an .xlsx file");
      return;
    }
    setUploading(true);
    try {
      const rooms = await parseAmenitizXlsx(file);
      await saveRoomsToSupabase(today, rooms);
      setPreview(rooms);
      toast.success(`${t("amenitiz.success")}: ${rooms.length} rooms`);
      onImported?.(rooms);
    } catch (err) {
      toast.error(`${t("amenitiz.error")}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">{t("amenitiz.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("amenitiz.sub")}</p>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{t("amenitiz.drop")}</p>
        <Button variant="outline" size="sm" className="mt-4" disabled={uploading}>
          {uploading ? t("amenitiz.uploading") : t("amenitiz.upload")}
        </Button>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onInputChange} />
      </div>

      {preview && preview.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-secondary/20 flex items-center justify-between">
            <span className="text-sm font-medium">{today} — {preview.length} rooms</span>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {preview.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <span className="font-medium">{r.room}</span>
                  {r.type && <span className="text-muted-foreground ml-2 text-xs">{r.type}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {r.guests > 0 && (
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.guests}</span>
                  )}
                  {r.checkout && (
                    <span className="flex items-center gap-1 text-orange-600 font-medium">
                      <LogOut className="h-3 w-3" /> Out
                    </span>
                  )}
                  {r.checkin && (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <LogIn className="h-3 w-3" /> In
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
