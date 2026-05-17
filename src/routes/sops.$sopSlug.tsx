import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/sops/$sopSlug")({ component: SopFrame });

const COMMIT = "d569416bf9305e5a496644ce194e324c03545185";
const BASE = `https://raw.githack.com/jorgeibanezhostack/guidebookstorridon/${COMMIT}`;

const SOP_FILES: Record<string, string> = {
  breakfast: "breakfast-sop-multilang.html",
  housekeeping: "housekeeping-sop-multilang.html",
  cottages: "cottages-sop-multilang.html",
  laundry: "laundry-sop-multilang.html",
  checkin: "checkin-sop-en.html",
};

function SopFrame() {
  const { sopSlug } = useParams({ from: "/sops/$sopSlug" });
  const file = SOP_FILES[sopSlug];
  if (!file) throw notFound();
  const url = `${BASE}/${file}`;

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex items-center px-3 py-2 border-b bg-card/95 backdrop-blur z-10">
        <Link
          to="/sops"
          className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" /> Back to SOPs
        </Link>
      </div>
      <iframe
        src={url}
        title={`SOP ${sopSlug}`}
        className="w-full h-screen border-0 flex-1"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
