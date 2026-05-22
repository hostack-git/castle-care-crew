import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { hostackSupabase } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await hostackSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://tanstack-start-app.hostack.workers.dev/reset-password',
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
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
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-display text-3xl font-semibold">Recuperar contraseña</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Te enviaremos un email con instrucciones.
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-4 text-sm">
                Revisa tu email para restablecer tu contraseña.
              </div>
              <Link to="/login" className="text-accent text-sm hover:underline">
                ← Volver al login
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
              <p className="text-center text-sm">
                <Link to="/login" className="text-accent hover:underline">
                  ← Volver al login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
