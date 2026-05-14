import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: Signup,
});

function Signup() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fromQr =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "qr";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error: authErr } = await hostackSupabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (authErr) throw authErr;

      const { error: reqErr } = await hostackSupabase
        .from("staff_access_requests")
        .insert({
          property_id: TORRIDONIA_PROPERTY_ID,
          email: email.trim(),
          name: name.trim(),
          whatsapp: whatsapp.trim() || null,
          requested_role: "volunteer",
          status: "pending",
          auth_user_id: authData.user?.id ?? null,
        });
      if (reqErr) throw reqErr;

      // Sign out so the volunteer can't reach the app until approved
      await hostackSupabase.auth.signOut();
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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

        {submitted ? (
          <div className="w-full max-w-sm text-center space-y-5">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 grid place-items-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Solicitud enviada</h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Tu solicitud ha sido enviada. El manager aprobará tu acceso pronto.
                Te notificaremos por WhatsApp.
              </p>
            </div>
            <Link to="/login" className="text-sm text-accent hover:underline inline-block">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
            <div>
              <h1 className="font-display text-3xl font-semibold">{t("auth.createTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {fromQr
                  ? "Escanéaste el QR de Torridonia — completa tu registro para acceder a la app del equipo 🏡"
                  : t("auth.createSub")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.fullName")}</Label>
              <Input id="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="whatsapp"
                type="tel"
                maxLength={32}
                placeholder="+44 …"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                maxLength={72}
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
        )}
      </div>
    </div>
  );
}
