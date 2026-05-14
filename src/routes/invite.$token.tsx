import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mountain, Loader2 } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({ component: InvitePage });

type Invitation = {
  id: string;
  token: string;
  name: string | null;
  role: string | null;
  email: string | null;
  used_at: string | null;
  expires_at: string;
};

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await hostackSupabase
        .from("staff_invitations")
        .select("id, token, name, role, email, used_at, expires_at")
        .eq("token", token)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      setInvitation((data as Invitation | null) ?? null);
      setLoading(false);
    })();
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    if (password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setSubmitting(true);

    const { data: authData, error: authErr } = await hostackSupabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: invitation.name } },
    });
    if (authErr || !authData.user) {
      setSubmitting(false);
      return toast.error(authErr?.message ?? "Error creando la cuenta");
    }

    const userId = authData.user.id;
    await hostackSupabase
      .from("volunteers")
      .update({ auth_user_id: userId, email })
      .eq("name", invitation.name)
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .is("auth_user_id", null);

    await hostackSupabase
      .from("staff_invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    toast.success("Cuenta creada");
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-gradient-moss text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2 font-display text-xl">
          <Mountain className="h-6 w-6" /> Torridonia
        </div>
        <div>
          <h2 className="font-display text-4xl leading-tight">Bienvenido/a al equipo</h2>
          <p className="opacity-80 mt-3">Crea tu cuenta para acceder a turnos, guías y eventos del equipo.</p>
        </div>
        <p className="text-xs opacity-60">Castle of Torridonia · Galicia</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Validando invitación…</div>
          ) : !invitation ? (
            <div className="space-y-3">
              <h1 className="font-display text-2xl font-semibold">Link no válido</h1>
              <p className="text-sm text-muted-foreground">Este link ya fue usado o expiró. Contacta a tu manager para recibir uno nuevo.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="font-display text-3xl font-semibold">Crea tu cuenta</h1>
                <p className="text-sm text-muted-foreground mt-1">Invitación para <strong>{invitation.name}</strong>{invitation.role ? ` · ${invitation.role}` : ""}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={invitation.name ?? ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña (mín. 8)</Label>
                <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <Input id="confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {submitting ? "Creando cuenta…" : "Crear cuenta"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
