import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mountain, Loader2 } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({ component: InvitePage });

type Invitation = {
  id: string;
  token: string;
  name: string | null;
  role: string | null;
  used_at: string | null;
  expires_at: string;
};

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await hostackSupabase
        .from("staff_invitations")
        .select("id, token, name, role, used_at, expires_at")
        .eq("token", token)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      setInvitation((data as Invitation | null) ?? null);
      setLoading(false);
    })();
  }, [token]);

  const enter = async () => {
    if (!invitation) return;
    setSubmitting(true);
    try {
      const { data: anon, error: anonErr } = await hostackSupabase.auth.signInAnonymously();
      if (anonErr || !anon.user) throw anonErr ?? new Error("No se pudo entrar");

      await hostackSupabase.auth.updateUser({
        data: { full_name: invitation.name, role: "volunteer", property_id: TORRIDONIA_PROPERTY_ID },
      });

      await hostackSupabase
        .from("volunteers")
        .update({ auth_user_id: anon.user.id })
        .eq("name", invitation.name)
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .is("auth_user_id", null);

      await hostackSupabase
        .from("staff_invitations")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      navigate({ to: "/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al entrar");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-gradient-moss text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2 font-display text-xl">
          <Mountain className="h-6 w-6" /> Torridonia
        </div>
        <div>
          <h2 className="font-display text-4xl leading-tight">Bienvenido/a al equipo</h2>
          <p className="opacity-80 mt-3">Un solo click y estás dentro.</p>
        </div>
        <p className="text-xs opacity-60">Castle of Torridonia · Galicia</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando invitación…
            </div>
          ) : !invitation ? (
            <div className="space-y-3">
              <h1 className="font-display text-2xl font-semibold">Link no válido</h1>
              <p className="text-sm text-muted-foreground">
                Este link ya fue usado o expiró. Contacta a tu manager para recibir uno nuevo.
              </p>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <h1 className="font-display text-3xl font-semibold">
                Hola {invitation.name}! 👋
              </h1>
              <p className="text-base text-muted-foreground">
                Tu manager te invita a Torridonia 🏡
              </p>
              <Button
                onClick={enter}
                disabled={submitting}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base"
              >
                {submitting ? "Entrando…" : "Entrar a la app"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
