import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { SOPS } from "@/lib/sops";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, Megaphone, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const categoryIcon = (category: string | null) => {
  const key = (category ?? "").toLowerCase();
  if (key === "housekeeping") return "🧹";
  if (key === "kitchen operations") return "🍳";
  if (key === "safety & maintenance") return "⚠️";
  if (key === "maintenance") return "🔧";
  if (key === "laundry") return "👕";
  if (key === "cottages") return "🏡";
  return "📘";
};

type Playbook = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
};

const LOCAL_PLAYBOOKS: Playbook[] = SOPS.slice(0, 5).map((sop) => ({
  id: `local-${sop.id}`,
  title: sop.title,
  description: sop.subtitle,
  category: sop.icon === "coffee" ? "Kitchen Operations" : sop.icon === "wrench" ? "Maintenance" : sop.title.replace(" SOP", ""),
}));

function Onboarding() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("onboarding_done") === "true") {
      navigate({ to: "/app/dashboard" });
    }
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await hostackSupabase
          .from("playbooks")
          .select("id, title, description, category")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .eq("is_archived", false)
          .order("order_index", { ascending: true })
          .limit(5);
        if (!mounted) return;
        if (error || !data || data.length === 0) {
          setPlaybooks(LOCAL_PLAYBOOKS);
        } else {
          setPlaybooks(data as Playbook[]);
        }
      } catch {
        if (mounted) setPlaybooks(LOCAL_PLAYBOOKS);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const finish = () => {
    localStorage.setItem("onboarding_done", "true");
    navigate({ to: "/app/dashboard" });
  };

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{t("onb.stepOf").replace("{step}", String(step))}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-soft space-y-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-3xl font-semibold">{t("onb.title")}</h1>
                <p className="text-muted-foreground mt-2">{t("onb.subtitle")}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {playbooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("onb.noGuides")}</p>
                ) : (
                  playbooks.map((p) => (
                    <div key={p.id} className="rounded-xl border bg-secondary/30 p-4">
                      <div className="text-2xl mb-2">{categoryIcon(p.category)}</div>
                      <p className="font-medium text-sm">{p.title ?? "—"}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  {t("common.next")} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-2xl font-semibold">{t("onb.howTitle")}</h2>
                <p className="text-muted-foreground mt-2">{t("onb.howSub")}</p>
              </div>
              <div className="grid gap-3">
                <InfoCard icon={<Calendar className="h-5 w-5" />} emoji="📅" title={t("onb.card1Title")} text={t("onb.card1Text")} />
                <InfoCard icon={<BookOpen className="h-5 w-5" />} emoji="📖" title={t("onb.card2Title")} text={t("onb.card2Text")} />
                <InfoCard icon={<Megaphone className="h-5 w-5" />} emoji="📣" title={t("onb.card3Title")} text={t("onb.card3Text")} />
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>{t("common.back")}</Button>
                <Button onClick={() => setStep(3)} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  {t("common.next")} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center py-6">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent mx-auto">
                <Sparkles className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-display text-3xl font-semibold">{t("onb.doneTitle")}</h2>
                <p className="text-muted-foreground mt-2">{t("onb.doneSub")}</p>
              </div>
              <Button onClick={finish} size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                {t("onb.viewShift")} <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, emoji, title, text }: { icon: React.ReactNode; emoji: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-secondary/30 p-4 flex items-start gap-3">
      <div className="text-2xl">{emoji}</div>
      <div className="flex-1">
        <p className="font-medium flex items-center gap-2">{icon} {title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{text}</p>
      </div>
    </div>
  );
}
