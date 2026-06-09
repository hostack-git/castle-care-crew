import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/guidebook/sop/$sopId")({
  component: SopPage,
});

const BASE = `${import.meta.env.BASE_URL}sops`;

const FILE_MAP: Record<string, string> = {
  breakfast:    `${BASE}/breakfast-sop-multilang.html`,
  housekeeping: `${BASE}/housekeeping-sop-multilang.html`,
  cottages:     `${BASE}/cottages-sop-multilang.html`,
  laundry:      `${BASE}/laundry-sop-multilang.html`,
  checkin:      `${BASE}/checkin-sop-en.html`,
};

function SopPage() {
  const { sopId } = useParams({ from: "/app/guidebook/sop/$sopId" });
  const src = FILE_MAP[sopId];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 shrink-0 mb-1">
        <Link to="/app/guidebook">
          <ChevronLeft className="h-4 w-4 mr-1" /> Guidebook
        </Link>
      </Button>
      {!src ? (
        <p className="text-muted-foreground">SOP not found.</p>
      ) : (
        <iframe
          src={src}
          title={`SOP ${sopId}`}
          className="flex-1 w-full rounded-2xl border bg-white"
          allow="clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
