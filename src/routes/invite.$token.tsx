import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
      if (anonErr || !anon.user) throw anonErr ?? new Error("Login failed");

      await hostackSupabase.auth.updateUser({
        data: { full_name: invitation.name, role: "volunteer", property_id: TORRIDONIA_PROPERTY_ID },
      });

      await hostackSupabase
        .from("volunteers")
        .update({ auth_user_id: anon.user.id })
        .eq("name", invitation.name)
        .eq("property_id", TORRIDONIA_PROPERTY_ID);

      await hostackSupabase
        .from("staff_invitations")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      navigate({ to: "/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-cream-paper p-12 flex-col justify-between">
        <img src="/staffapp/torridonia-logo.png" alt="Torridonia" className="h-20 w-auto mix-blend-multiply" />
        <div>
          <h2 className="font-display text-4xl leading-tight text-foreground">Welcome to the clan</h2>
          <p className="text-muted-foreground mt-3">Just one click and you are in.</p>
        </div>
        <p className="text-xs text-muted-foreground/60">Volunteer App · Torridonia, Scotland · Powered by Hostack</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <img src="/staffapp/torridonia-logo.png" alt="Torridonia" className="h-16 w-auto mix-blend-multiply mb-2" />
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validating…
            </div>
          ) : !invitation ? (
            <div className="space-y-3">
              <h1 className="font-display text-2xl font-semibold">Invalid Link</h1>
              <p className="text-sm text-muted-foreground">
                This link has already been used or has expired. Contact your manager to receive a new one.
              </p>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <h1 className="font-display text-3xl font-semibold">
                Hi {invitation.name}! 👋
              </h1>
              <p className="text-base text-muted-foreground">
                Your manager has invited you to the Torridonia app
              </p>
              <Button
                onClick={enter}
                disabled={submitting}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base"
              >
                {submitting ? "Loading…" : "Enter the app"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
