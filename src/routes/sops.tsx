import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sops")({
  component: SopsLayout,
});

const SOPS = [
  { slug: "breakfast", emoji: "🍳", title: "Breakfast Service", time: "7 AM - 12 PM" },
  { slug: "housekeeping", emoji: "🛏️", title: "Housekeeping (B&B Rooms)", time: "Ready by 3 PM" },
  { slug: "cottages", emoji: "🏡", title: "Cottages Cleaning", time: "Full day job" },
  { slug: "laundry", emoji: "🧺", title: "Laundry Service", time: "All day job" },
  { slug: "checkin", emoji: "🔑", title: "Guest Check-In", time: "On arrival" },
];

function SopsLayout() {
  const matchRoute = useMatchRoute();
  const isIndex = matchRoute({ to: "/sops" });

  if (!isIndex) return <Outlet />;

  return (
    <div className="min-h-screen bg-background p-6 sm:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold">SOPs</h1>
          <p className="text-muted-foreground mt-2">Standard Operating Procedures</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SOPS.map((sop) => (
            <Link
              key={sop.slug}
              to="/sops/$sopSlug"
              params={{ sopSlug: sop.slug }}
              className="group rounded-2xl border bg-card p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-primary/40 transition-all flex items-start gap-4"
            >
              <div className="text-5xl">{sop.emoji}</div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl font-semibold group-hover:text-primary transition-colors">
                  {sop.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{sop.time}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
