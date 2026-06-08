import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  name: z.string().optional(),
});

export const Route = createFileRoute("/join")({
  validateSearch: searchSchema,
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const { name: prefilledName } = useSearch({ from: "/join" });

  const [name, setName] = useState(prefilledName ?? "");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [alreadyAuthed, setAlreadyAuthed] = useState(false);
  const [existingUserName, setExistingUserName] = useState("");

  // Check if user is already authenticated (coming from volunteer-access redirect)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await hostackSupabase.auth.getUser();
      if (user && user.email === null) {
        // Already authenticated as anonymous volunteer
        setAlreadyAuthed(true);
        const fullName = (user.user_metadata as { full_name?: string } | undefined)?.full_name ?? "";
        setExistingUserName(fullName);
        setName(fullName);
      }
      setCheckingSession(false);
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      let userId: string;

      if (alreadyAuthed) {
        // Already signed in — just update profile fields
        const { data: { user } } = await hostackSupabase.auth.getUser();
        if (!user) throw new Error("Session expired. Please log in again.");
        userId = user.id;
      } else {
        // New login via QR / WhatsApp link
        const { data: anon, error: anonErr } = await hostackSupabase.auth.signInAnonymously();
        if (anonErr || !anon.user) throw anonErr ?? new Error("Login fail");
        userId = anon.user.id;
        const { error: updateErr } = await hostackSupabase.auth.updateUser({
          data: { full_name: name.trim(), role: "volunteer", property_id: TORRIDONIA_PROPERTY_ID },
        });
        if (updateErr) throw updateErr;
      }

      // Match volunteer by name + update profile
      const { data: volunteer } = await hostackSupabase
        .from("volunteers")
        .select("id, auth_user_id")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .ilike("name", name.trim())
        .maybeSingle();

      if (volunteer?.id) {
        const updates: Record<string, unknown> = { whatsapp_number: whatsapp.trim() || null };
        if (!volunteer.auth_user_id) updates.auth_user_id = userId;
        const { error: volErr } = await hostackSupabase
          .from("volunteers")
          .update(updates)
          .eq("id", volunteer.id);
        if (volErr) {
          console.error("volunteer update failed:", volErr);
          throw new Error(`Link profile failed: ${volErr.message}`);
        }
      } else {
        toast.error(`"${name.trim()}" Not on the active volunteer list. Please verify your name with the manager.`);
      }

      navigate({ to: "/app/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login Error");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-paper">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-cream-paper">
      {/* Left panel — branding */}
      <div className="hidden lg:flex bg-cream-paper p-12 flex-col justify-between">
        <img src="/staffapp/torridonia-logo.png" alt="Torridonia" className="h-20 w-auto mix-blend-multiply" />
        <div>
          <h2 className="font-display text-4xl leading-tight text-foreground">
            {alreadyAuthed ? `Welcome back, ${existingUserName}!` : "Welcome to the clan"}
          </h2>
          <p className="text-muted-foreground mt-3">
            {alreadyAuthed
              ? "Complete your profile to receive shift notifications."
              : "Log in using the link sent by your manager or scan the QR code on the property."}
          </p>
        </div>
        <p className="text-xs text-muted-foreground/60">Volunteer App · Torridonia, Scotland · Powered by Hostack</p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="flex flex-col items-center mb-2 lg:hidden">
            <img src="/staffapp/torridonia-logo.png" alt="Torridonia" className="h-16 w-auto mix-blend-multiply mb-4" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">
              {alreadyAuthed ? "Complete your profile" : "Join the Clan"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {alreadyAuthed
                ? "Add your WhatsApp and email to get your shift."
                : "Fill your name and contact details."}
            </p>
          </div>

          {!alreadyAuthed && (
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                required
                autoFocus={!prefilledName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                readOnly={!!prefilledName}
                className={prefilledName ? "bg-secondary/40" : ""}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              autoFocus={alreadyAuthed}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+34 600 000 000"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading…" : alreadyAuthed ? "Save and continue" : "Join the clan"}
          </Button>

          {alreadyAuthed && (
            <p className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground underline"
                onClick={() => navigate({ to: "/app/dashboard" })}
              >
                Not now
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
