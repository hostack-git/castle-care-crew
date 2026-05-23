import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  name: z.string().optional(),
});

export const Route = createFileRoute("/join")({
  validateSearch: searchSchema,
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const { name: prefilledName } = useSearch({ from: "/join" });

  const [name, setName] = useState(prefilledName ?? "");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [alreadyAuthed, setAlreadyAuthed] = useState(false);
  const [existingUserName, setExistingUserName] = useState("");

  // Check if user is already authenticated (coming from volunteer-access redirect)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await hostackSupabase.auth.getUser();
      if (user && user.email === null) {
        // Already authenticated as anonymous volunteer
        setAlreadyAuthed(true);
        const fullName = (user.user_metadata as { full_name?: string } | undefined)?.full_name ?? "";
        setExistingUserName(fullName);
        setName(fullName);
      }
      setCheckingSession(false);
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      let userId: string;

      if (alreadyAuthed) {
        // Already signed in — just update profile fields
        const { data: { user } } = await hostackSupabase.auth.getUser();
        if (!user) throw new Error("Sesión expirada. Vuelve a entrar.");
        userId = user.id;
      } else {
        // New login via QR / WhatsApp link
        const { data: anon, error: anonErr } = await hostackSupabase.auth.signInAnonymously();
        if (anonErr || !anon.user) throw anonErr ?? new Error("No se pudo iniciar sesión");
        userId = anon.user.id;
        const { error: updateErr } = await hostackSupabase.auth.updateUser({
          data: { full_name: name.trim(), role: "volunteer", property_id: TORRIDONIA_PROPERTY_ID },
        });
        if (updateErr) throw updateErr;
      }

      // Match volunteer by name + update profile
      const { data: volunteer } = await hostackSupabase
        .from("volunteers")
        .select("id, auth_user_id")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .ilike("name", name.trim())
        .maybeSingle();

      if (volunteer?.id) {
        const updates: Record<string, unknown> = { whatsapp_number: whatsapp.trim() || null };
        if (!volunteer.auth_user_id) updates.auth_user_id = userId;
        const { error: volErr } = await hostackSupabase
          .from("volunteers")
          .update(updates)
          .eq("id", volunteer.id);
        if (volErr) {
          console.error("volunteer update failed:", volErr);
          throw new Error(`No se pudo vincular tu perfil: ${volErr.message}`);
        }
      } else {
        toast.error(`"${name.trim()}" no está en la lista de voluntarios activos. Verifica tu nombre con el manager.`);
      }

      navigate({ to: "/app/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al entrar");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-paper">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-cream-paper">
      {/* Left panel — branding */}
      <div className="hidden lg:flex gradient-moss text-cream p-12 flex-col justify-between">
        <div className="flex items-center gap-2 font-display text-xl">
          <Mountain className="h-6 w-6" /> Torridonia
        </div>
        <div>
          <h2 className="font-display text-4xl leading-tight">
            {alreadyAuthed ? `Hola, ${existingUserName}!` : "Bienvenido/a al equipo"}
          </h2>
          <p className="opacity-80 mt-3">
            {alreadyAuthed
              ? "Completa tu perfil para recibir notificaciones de tus turnos."
              : "Entra con el link que te envió tu manager o escanea el QR de la propiedad."}
          </p>
        </div>
        <p className="text-xs opacity-60">Castle of Torridonia · Galicia</p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              {alreadyAuthed ? "Completa tu perfil" : "Entrar al equipo"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {alreadyAuthed
                ? "Añade tu WhatsApp y email para recibir tu turno."
                : "Rellena tu nombre y datos de contacto."}
            </p>
          </div>

          {!alreadyAuthed && (
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                required
                autoFocus={!prefilledName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                readOnly={!!prefilledName}
                className={prefilledName ? "bg-secondary/40" : ""}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              autoFocus={alreadyAuthed}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+34 600 000 000"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : alreadyAuthed ? "Guardar y entrar" : "Unirse al equipo"}
          </Button>

          {alreadyAuthed && (
            <p className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground underline"
                onClick={() => navigate({ to: "/app/dashboard" })}
              >
                Ahora no
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
