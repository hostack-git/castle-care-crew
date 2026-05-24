import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import torridoniaLogo from "@/assets/torridonia-logo.svg";

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
      <div className="hidden lg:flex gradient-moss text-cream p-12 flex-col justify-between">
        <div className="text-cream/60 text-sm font-medium tracking-widest uppercase">
          Castle of Torridonia
        </div>
        <div>
          <h2 className="font-display text-4xl leading-tight text-cream">
            Welcome to the clan, we're happy to welcome you
          </h2>
          <p className="opacity-80 mt-3 text-cream/80">One tap and you're in.</p>
        </div>
        <p className="text-xs opacity-40">Volunteer Hub · Torridonia, Scotland</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your invite…
            </div>
          ) : !invitation ? (
            <div className="space-y-3">
              <h1 className="font-display text-2xl font-semibold">Link not valid</h1>
              <p className="text-sm text-muted-foreground">
                This link has already been used or has expired. Contact your manager for a new one.
              </p>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <img src={torridoniaLogo} alt="Torridonia" className="h-20 w-auto" />
              </div>
              <h1 className="font-display text-3xl font-semibold">
                Hi {invitation.name}! 👋
              </h1>
              <p className="text-base text-muted-foreground">
                Your manager has invited you to join the Torridonia team 🏡
              </p>
              <Button
                onClick={enter}
                disabled={submitting}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base"
              >
                {submitting ? "Joining…" : "Enter the app"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
