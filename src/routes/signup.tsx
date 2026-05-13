import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { hostackSupabase } from "@/integrations/hostack/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/app/dashboard`;
    const { error } = await hostackSupabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — let's complete your profile.");
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="min-h-screen bg-cream-paper grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-warm text-cream">
        <div className="flex items-center gap-2">
          <Mountain className="h-6 w-6" />
          <span className="font-display text-xl font-semibold">Torridon</span>
        </div>
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight max-w-md">
            Welcome to Torridonia.
          </h2>
          <p className="mt-4 text-cream/85 max-w-sm">
            A community living and working in one of the wildest corners of Scotland. Glad you're joining us.
          </p>
        </div>
        <p className="text-xs text-cream/70">It only takes a minute.</p>
      </div>

      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute top-4 right-4"><LanguageSwitcher compact /></div>
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-display text-3xl font-semibold">{t("auth.createTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.createSub")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.fullName")}</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          </div>
          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-warm" disabled={loading}>
            {loading ? t("auth.creating") : t("auth.create")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.haveOne")}{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
