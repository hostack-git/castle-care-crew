import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Calendar, BookOpen, MessageCircle, Mountain } from "lucide-react";
import heroImg from "@/assets/highlands-hero.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="Torridon Highlands at golden hour"
          width={1920}
          height={1080}
          className="absolute inset-0 -z-10 h-[100vh] w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[oklch(0.18_0.02_60/0.45)] via-[oklch(0.18_0.02_60/0.55)] to-[oklch(0.18_0.02_60/0.85)]" />

        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2 text-cream">
            <Mountain className="h-6 w-6" />
            <span className="font-display text-xl font-semibold tracking-tight">Torridon</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" className="text-cream hover:bg-white/10 hover:text-cream">
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-warm">
                Join the team
              </Button>
            </Link>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-6xl flex-col items-start justify-center px-6 pb-20">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-cream backdrop-blur">
            <Sparkles className="h-3 w-3" /> Scottish Highlands · Torridon House
          </span>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] text-cream sm:text-6xl md:text-7xl max-w-3xl">
            A calmer way to live <span className="italic text-accent">&amp; work</span> together.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/85">
            One home for your weekly tasks, the team calendar, the house guidebook and the
            adventures you share with the rest of the volunteers — no more scrolling through WhatsApp.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/signup">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-warm">
                Create your account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-cream hover:bg-white/20 hover:text-cream"
              >
                I already have one
              </Button>
            </Link>
          </div>
        </main>
      </div>

      {/* Feature strip */}
      <section className="bg-cream-paper py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Everything in one quiet place
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-foreground">
              Built for the way Torridon really works
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Calendar, title: "Your week, at a glance", body: "See your shifts, locations and checklists for the next seven days." },
              { icon: BookOpen, title: "The house guidebook", body: "Wifi codes, kitchen rules, cottage notes — searchable in your language." },
              { icon: MessageCircle, title: "An assistant that knows the house", body: "Ask the chatbot in English, Português, Español or Deutsch." },
              { icon: Mountain, title: "Adventures wall", body: "Share trails, swims and the best spots you find on your days off." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t bg-card py-8 text-center text-xs text-muted-foreground">
        <p>Torridon House · Achnasheen, Scottish Highlands</p>
      </footer>
    </div>
  );
}
