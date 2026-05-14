import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { hostackSupabase } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/constants";
import { toast } from "sonner";
import { Upload, CheckCircle2, Mountain } from "lucide-react";

const APP_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
] as const;
type AppLang = (typeof APP_LANGUAGES)[number]["code"];

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [nationality, setNationality] = useState("");
  const [language, setLanguage] = useState<AppLang>("en");
  const [phone, setPhone] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (profile) {
      setFullName(profile.full_name ?? "");
      setNationality(profile.nationality ?? "");
      const pref = (profile as unknown as { preferred_language?: AppLang }).preferred_language;
      setLanguage(pref ?? (["en", "es", "pt"].includes(profile.language) ? (profile.language as AppLang) : "en"));
      setPhone(profile.phone ?? "");
      setPassportNumber(profile.passport_number ?? "");
    }
  }, [loading, user, profile, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      let passportUrl = profile?.passport_url ?? null;
      if (passportFile) {
        const ext = passportFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/passport-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("passports")
          .upload(path, passportFile, { upsert: true });
        if (upErr) throw upErr;
        passportUrl = path;
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          nationality,
          language,
          phone,
          passport_number: passportNumber,
          passport_url: passportUrl,
          onboarded: true,
        })
        .eq("id", user.id);
      if (error) throw error;
      // Persistir idioma preferido en Hostack staff
      await hostackSupabase
        .from("staff")
        .update({ preferred_language: language })
        .eq("auth_user_id", user.id);
      await refreshProfile();
      toast.success("Profile complete — welcome to the team!");
      navigate({ to: "/app/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-paper py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-2 text-primary">
          <Mountain className="h-6 w-6" />
          <span className="font-display text-xl font-semibold">Torridon</span>
        </div>

        <div className="rounded-2xl bg-card p-8 shadow-soft border">
          <h1 className="font-display text-3xl font-semibold">A few details</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Felix needs your passport on file and your contact info for emergencies.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality</Label>
                <Input id="nationality" required value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Brazilian, German…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (with country code)</Label>
                <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 …" />
              </div>
              <div className="space-y-2">
                <Label>Preferred language</Label>
                <Select
                  value={language}
                  onValueChange={async (v) => {
                    const next = v as AppLang;
                    setLanguage(next);
                    if (user) {
                      await hostackSupabase
                        .from("staff")
                        .update({ preferred_language: next })
                        .eq("auth_user_id", user.id);
                      await refreshProfile();
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {APP_LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.flag} {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="passport">Passport number</Label>
                <Input id="passport" required value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Passport photo</Label>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-dashed bg-secondary/40 px-4 py-6 cursor-pointer hover:bg-secondary transition">
                <div className="flex items-center gap-3">
                  {passportFile || profile?.passport_url ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {passportFile?.name ?? (profile?.passport_url ? "Passport on file" : "Upload a clear photo")}
                    </p>
                    <p className="text-xs text-muted-foreground">JPG or PNG · only Felix &amp; admins can see it</p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setPassportFile(e.target.files?.[0] ?? null)}
                />
                <span className="text-sm font-medium text-accent">Choose file</span>
              </label>
            </div>

            <Button type="submit" disabled={submitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-warm">
              {submitting ? "Saving…" : "Save and continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
