import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { hostackSupabase } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const verifyRecoveryLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await hostackSupabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (error) {
          setVerifyError("El enlace expiró o ya fue usado. Solicita uno nuevo.");
          return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        setReady(true);
        return;
      }

      const { data } = await hostackSupabase.auth.getSession();
      if (!mounted) return;
      if (data.session) setReady(true);
      else setVerifyError("Abre esta página desde el enlace de recuperación que recibiste por email.");
    };

    const { data: sub } = hostackSupabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setVerifyError(null);
      }
    });

    verifyRecoveryLink();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const { error } = await hostackSupabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await hostackSupabase.auth.signOut();
    toast.success("Contraseña actualizada");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-cream-paper grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-moss text-cream">
        <div className="flex items-center gap-2">
          <Mountain className="h-6 w-6" />
          <span className="font-display text-xl font-semibold">Torridon</span>
        </div>
        <p className="text-xs text-cream/60">Volunteer Hub · Torridon House, Scotland</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-display text-3xl font-semibold">Nueva contraseña</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige una contraseña segura (mínimo 8 caracteres).
            </p>
          </div>
          {verifyError && (
            <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              {verifyError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !ready}>
            {loading ? "Actualizando..." : ready ? "Actualizar contraseña" : "Verificando enlace..."}
          </Button>
        </form>
      </div>
    </div>
  );
}
