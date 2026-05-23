import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { hostackSupabase } from "@/integrations/hostack/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode } from "lucide-react";
import { toast } from "sonner";
import torridoniaLogo from "@/assets/torridonia-logo.svg";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await hostackSupabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/app/dashboard" });
  };

  return (
    <div className="min-h-screen bg-cream-paper grid lg:grid-cols-2">
      {/* Left panel — branding + volunteer instructions (desktop only) */}
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-moss text-cream">
        <div className="text-cream/60 text-sm font-medium tracking-widest uppercase">
          Castle of Torridonia
        </div>

        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight max-w-md text-cream">
            Welcome to the clan, we're happy to welcome you
          </h2>

          <div className="mt-10 space-y-4">
            <p className="text-cream/60 text-xs font-semibold uppercase tracking-widest">
              How to join as a volunteer
            </p>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-cream/20 flex items-center justify-center text-xs font-bold text-cream">
                  1
                </span>
                <span className="text-cream/80 text-sm leading-relaxed">
                  Get your invite link or QR code from your manager
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-cream/20 flex items-center justify-center text-xs font-bold text-cream">
                  2
                </span>
                <span className="text-cream/80 text-sm leading-relaxed">
                  Scan the QR or tap the link — no password, ever
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-cream/20 flex items-center justify-center text-xs font-bold text-cream">
                  3
                </span>
                <span className="text-cream/80 text-sm leading-relaxed">
                  Enter your name and you're straight in
                </span>
              </li>
            </ol>
          </div>
        </div>

        <p className="text-xs text-cream/40">Volunteer Hub · Torridonia, Scotland</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher compact />
        </div>

        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          {/* Logo — shown on all screens */}
          <div className="flex justify-center">
            <img
              src={torridoniaLogo}
              alt="Torridonia"
              className="h-24 w-auto"
            />
          </div>

          <div>
            <h1 className="font-display text-3xl font-semibold">{t("auth.welcome")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.signinSub")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </Button>

          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-accent hover:underline">
              Forgot your password?
            </Link>
          </p>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-cream-paper px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Link
            to="/volunteer-access"
            className="flex items-center justify-center gap-2 w-full rounded-md border-2 border-accent bg-accent/5 hover:bg-accent/10 text-accent font-medium py-3 transition"
          >
            <QrCode className="h-5 w-5" />
            I'm a volunteer → Access with link or QR
          </Link>
        </form>
      </div>
    </div>
  );
}
