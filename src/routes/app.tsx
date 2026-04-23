import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Mountain, LayoutDashboard, Calendar, BookOpen, Mountain as Trail, Megaphone, MessageCircle, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [loading, user, profile, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const nav = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/calendar", label: "Calendar", icon: Calendar },
    { to: "/app/guidebook", label: "Guidebook", icon: BookOpen },
    { to: "/app/adventures", label: "Adventures", icon: Trail },
    { to: "/app/announcements", label: "Announcements", icon: Megaphone },
    { to: "/app/chat", label: "Ask Torra", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-cream-paper">
      <aside className="fixed inset-y-0 left-0 hidden lg:flex w-64 flex-col bg-sidebar border-r p-5">
        <Link to="/app/dashboard" className="flex items-center gap-2 mb-8">
          <Mountain className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold">Torridon</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/app/admin"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                loc.pathname.startsWith("/app/admin")
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <Settings className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
          <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email}</p>
          <Button variant="ghost" size="sm" onClick={signOut} className="mt-3 w-full justify-start text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-20 bg-card border-b px-4 py-3 flex items-center justify-between">
        <Link to="/app/dashboard" className="flex items-center gap-2">
          <Mountain className="h-5 w-5 text-primary" />
          <span className="font-display font-semibold">Torridon</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl p-6 lg:p-10 pb-24">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-card border-t flex justify-around py-2">
          {nav.slice(0, 5).map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
