import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase } from "@/integrations/hostack/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Users, Sparkles } from "lucide-react";

const torridoniaLogo = "/staffapp/torridonia-logo.png";

export const Route = createFileRoute("/demo")({ component: DemoPage });

function DemoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"manager" | "volunteer" | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app/dashboard" });
  }, [loading, user, navigate]);

  const loginAs = async (role: "manager" | "volunteer") => {
    setBusy(role);
    try {
      // Sign out any existing session first
      await hostackSupabase.auth.signOut();

      const { data, error } = await hostackSupabase.auth.signInAnonymously();
      if (error || !data.user) throw error ?? new Error("Sign-in failed");

      const meta =
        role === "manager"
          ? { demo_admin: true, full_name: "Demo Manager" }
          : { demo_admin: false, full_name: "Emma Thomson" };

      await hostackSupabase.auth.updateUser({ data: meta });
      navigate({ to: "/app/dashboard" });
    } catch (e) {
      console.error(e);
      setBusy(null);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#084e59] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <img src={torridoniaLogo} alt="Torridonia" className="h-16 w-auto brightness-0 invert" />
          <div>
            <h1 className="text-3xl font-display font-semibold text-white">Staff App Demo</h1>
            <p className="mt-2 text-white/70 text-sm leading-relaxed max-w-xs mx-auto">
              Explore how Torridonia's team manages daily operations — rotas, cleaning schedules, announcements and more.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <button
            onClick={() => loginAs("manager")}
            disabled={busy !== null}
            className="group relative rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 transition-all p-6 text-left disabled:opacity-60"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-xl bg-accent/20 p-3">
                <ShieldCheck className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-white text-lg">Manager View</p>
                <p className="mt-1 text-white/60 text-sm">
                  See the rota builder, cleaning schedule matrix, volunteer list, and all admin tools.
                </p>
              </div>
            </div>
            {busy === "manager" && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/30">
                <Sparkles className="h-5 w-5 text-white animate-pulse" />
              </div>
            )}
          </button>

          <button
            onClick={() => loginAs("volunteer")}
            disabled={busy !== null}
            className="group relative rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 transition-all p-6 text-left disabled:opacity-60"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-xl bg-white/20 p-3">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-lg">Volunteer View</p>
                <p className="mt-1 text-white/60 text-sm">
                  Experience the app as a volunteer — weekly rota, today's rooms to clean, guidebook and announcements.
                </p>
              </div>
            </div>
            {busy === "volunteer" && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/30">
                <Sparkles className="h-5 w-5 text-white animate-pulse" />
              </div>
            )}
          </button>
        </div>

        <p className="text-white/40 text-xs">
          Demo environment — no personal data is stored or required.
        </p>
      </div>
    </div>
  );
}
