import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { User, Phone } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const displayName = profile?.full_name || user?.email || "";

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">{t("nav.settings")}</h1>

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <User className="h-4 w-4" /> Profile
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Name</p>
          <p className="font-medium">{displayName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="font-medium">{user?.email}</p>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Language</div>
        <LanguageSwitcher />
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <Phone className="h-4 w-4" /> WhatsApp
        </div>
        <a
          href="https://chat.whatsapp.com/torridonia"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline text-sm"
        >
          Join staff WhatsApp group
        </a>
      </section>
    </div>
  );
}
