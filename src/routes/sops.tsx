import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/sops")({ component: SopsIndex });

const SOPS = [
  { slug: "breakfast", emoji: "🍳", title: "Breakfast Service", subtitle: "7 AM - 12 PM" },
  { slug: "housekeeping", emoji: "🛏️", title: "Housekeeping (B&B Rooms)", subtitle: "Ready by 3 PM" },
  { slug: "cottages", emoji: "🏡", title: "Cottages Cleaning", subtitle: "Full day job" },
  { slug: "laundry", emoji: "🧺", title: "Laundry Service", subtitle: "All day job" },
  { slug: "checkin", emoji: "🔑", title: "Guest Check-In", subtitle: "On arrival" },
] as const;

function SopsIndex() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="font-display text-3xl font-semibold mb-6">SOPs</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SOPS.map((s) => (
          <Link
            key={s.slug}
            to="/sops/$sopSlug"
            params={{ sopSlug: s.slug }}
            className="group rounded-2xl border bg-card p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 transition-all flex items-center gap-4"
          >
            <div className="text-5xl">{s.emoji}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-lg">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
