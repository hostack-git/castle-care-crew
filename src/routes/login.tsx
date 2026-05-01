import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain } from "lucide-react";
import { toast } from "sonner";

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-moss text-cream">
        <div className="flex items-center gap-2">
          <Mountain className="h-6 w-6" />
          <span className="font-display text-xl font-semibold">Torridon</span>
        </div>
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight max-w-md">
            “The mountains are calling and I must go.”
          </h2>
          <p className="mt-4 text-cream/80">— John Muir</p>
        </div>
        <p className="text-xs text-cream/60">Volunteer Hub · Torridon House, Scotland</p>
      </div>

      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute top-4 right-4"><LanguageSwitcher compact /></div>
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-display text-3xl font-semibold">{t("auth.welcome")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.signinSub")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.newHere")}{" "}
            <Link to="/signup" className="text-accent font-medium hover:underline">
              {t("auth.createAcc")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
