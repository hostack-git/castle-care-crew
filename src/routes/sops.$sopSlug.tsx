import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

const SOP_URLS: Record<string, { url: string; title: string }> = {
  breakfast: {
    url: "https://jorgeibanezhostack.github.io/guidebookstorridon/breakfast-sop-multilang.html",
    title: "Breakfast Service",
  },
  housekeeping: {
    url: "https://jorgeibanezhostack.github.io/guidebookstorridon/housekeeping-sop-multilang.html",
    title: "Housekeeping",
  },
  cottages: {
    url: "https://jorgeibanezhostack.github.io/guidebookstorridon/cottages-sop-multilang.html",
    title: "Cottages",
  },
  laundry: {
    url: "https://jorgeibanezhostack.github.io/guidebookstorridon/laundry-sop-multilang.html",
    title: "Laundry",
  },
  checkin: {
    url: "https://jorgeibanezhostack.github.io/guidebookstorridon/checkin-sop-en.html",
    title: "Guest Check-In",
  },
};

export const Route = createFileRoute("/sops/$sopSlug")({
  component: SopPage,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p className="mb-4">SOP not found.</p>
      <Link to="/sops" className="text-primary underline">Back to SOPs</Link>
    </div>
  ),
  loader: ({ params }) => {
    if (!SOP_URLS[params.sopSlug]) throw notFound();
    return null;
  },
});

function SopPage() {
  const { sopSlug } = useParams({ from: "/sops/$sopSlug" });
  const sop = SOP_URLS[sopSlug];
  if (!sop) return null;

  return (
    <div className="relative">
      <Link
        to="/sops"
        className="fixed top-4 left-4 z-50 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur border px-3 py-2 text-sm font-medium shadow-md hover:bg-secondary transition"
      >
        <ChevronLeft className="h-4 w-4" /> SOPs
      </Link>
      <iframe
        src={sop.url}
        title={sop.title}
        className="w-full h-screen border-0"
        allow="clipboard-write"
      />
    </div>
  );
}
