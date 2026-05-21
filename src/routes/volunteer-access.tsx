import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/volunteer-access")({ component: VolunteerAccess });

function VolunteerAccess() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data: anon, error: anonErr } = await hostackSupabase.auth.signInAnonymously();
      if (anonErr || !anon.user) throw anonErr ?? new Error("No se pudo iniciar sesión");

      await hostackSupabase.auth.updateUser({
        data: {
          full_name: name.trim(),
          role: "volunteer",
          property_id: TORRIDONIA_PROPERTY_ID,
        },
      });

      // Direct client-side volunteer binding — no server function needed
      const { data: volunteer } = await hostackSupabase
        .from("volunteers")
        .select("id")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .ilike("name", name.trim())
        .maybeSingle();

      if (volunteer?.id) {
        await hostackSupabase
          .from("volunteers")
          .update({ auth_user_id: anon.user.id })
          .eq("id", volunteer.id);
      }

      navigate({ to: "/app/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-cream-paper">
      <div className="hidden lg:flex bg-gradient-moss text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2 font-display text-xl">
          <Mountain className="h-6 w-6" /> Torridonia
        </div>
        <div>
          <h2 className="font-display text-4xl leading-tight">Bienvenido/a, voluntario/a</h2>
          <p className="opacity-80 mt-3">Entra al equipo en segundos. Sin email, sin contraseña.</p>
        </div>
        <p className="text-xs opacity-60">Castle of Torridonia · Galicia</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-display text-3xl font-semibold">Acceder como voluntario</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Usa el link que te envió tu manager o escanea el QR de la propiedad.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">¿Cuál es tu nombre?</Label>
            <Input
              id="name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Eres manager?{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
