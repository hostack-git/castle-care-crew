import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import torridoniaLogo from "@/assets/torridonia-logo.svg";

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
      if (anonErr || !anon.user) throw anonErr ?? new Error("Could not sign in");

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

      let profileComplete = false;
      if (volunteer?.id) {
        await hostackSupabase
          .from("volunteers")
          .update({ auth_user_id: anon.user.id })
          .eq("id", volunteer.id);
        // Check if contact info is already on file
        const { data: vol } = await hostackSupabase
          .from("volunteers")
          .select("whatsapp, email")
          .eq("id", volunteer.id)
          .single();
        profileComplete = !!(vol?.whatsapp);
      }

      // If volunteer has no WhatsApp → ask for contact info
      if (!profileComplete) {
        navigate({ to: "/join" });
      } else {
        const onboardingDone =
          typeof window !== "undefined" && localStorage.getItem("onboarding_done") === "true";
        navigate({ to: onboardingDone ? "/app/dashboard" : "/onboarding" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-cream-paper">
      {/* Left panel — welcome + instructions (desktop only) */}
      <div className="hidden lg:flex gradient-moss text-cream p-12 flex-col justify-between">
        <div className="text-cream/60 text-sm font-medium tracking-widest uppercase">
          Castle of Torridonia
        </div>

        <div>
          <h2 className="font-display text-4xl leading-tight text-cream">
            Welcome to the clan, we're happy to welcome you
          </h2>

          <div className="mt-10 space-y-4">
            <p className="text-cream/60 text-xs font-semibold uppercase tracking-widest">
              How it works
            </p>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-cream/20 flex items-center justify-center text-xs font-bold text-cream">
                  1
                </span>
                <span className="text-cream/80 text-sm leading-relaxed">
                  Enter your full name exactly as your manager registered you
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-cream/20 flex items-center justify-center text-xs font-bold text-cream">
                  2
                </span>
                <span className="text-cream/80 text-sm leading-relaxed">
                  Tap "Enter" — no password needed, ever
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-cream/20 flex items-center justify-center text-xs font-bold text-cream">
                  3
                </span>
                <span className="text-cream/80 text-sm leading-relaxed">
                  Check your shifts, read the guidebook, and stay in the loop
                </span>
              </li>
            </ol>
          </div>
        </div>

        <p className="text-xs opacity-40">Volunteer Hub · Torridonia, Scotland</p>
      </div>

      {/* Right panel — name form */}
      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src={torridoniaLogo}
              alt="Torridonia"
              className="h-24 w-auto"
            />
          </div>

          <div>
            <h1 className="font-display text-3xl font-semibold">Welcome, volunteer</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your name to access your shifts and the team hub.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">What's your name?</Label>
            <Input
              id="name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Joining…" : "Enter"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Are you a manager?{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">
              Sign in here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
