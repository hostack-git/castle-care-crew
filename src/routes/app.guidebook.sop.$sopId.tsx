import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/guidebook/sop/$sopId")({
  component: SopPage,
});

function SopPage() {
  const { sopId } = useParams({ from: "/app/guidebook/sop/$sopId" });
  const fileMap: Record<string, string> = {
    breakfast: "breakfast-sop-multilang.html",
    housekeeping: "housekeeping-sop-multilang.html",
    cottages: "cottages-sop-multilang.html",
    laundry: "laundry-sop-multilang.html",
    checkin: "checkin-sop-en.html",
  };
  const file = fileMap[sopId];

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/guidebook">
          <ChevronLeft className="h-4 w-4 mr-1" /> Guidebook
        </Link>
      </Button>
      {!file ? (
        <p className="text-muted-foreground">SOP not found.</p>
      ) : (
        <iframe
          src={`/sops/${file}`}
          title={`SOP ${sopId}`}
          className="w-full h-[calc(100vh-9rem)] rounded-2xl border bg-white"
          allow="clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
