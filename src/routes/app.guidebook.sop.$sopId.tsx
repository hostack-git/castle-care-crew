import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SopView } from "@/components/SopView";
import { getSop } from "@/lib/sops";

export const Route = createFileRoute("/app/guidebook/sop/$sopId")({
  component: SopPage,
});

function SopPage() {
  const { sopId } = useParams({ from: "/app/guidebook/sop/$sopId" });
  const sop = getSop(sopId);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/guidebook">
          <ChevronLeft className="h-4 w-4 mr-1" /> Guidebook
        </Link>
      </Button>
      {!sop ? <p className="text-muted-foreground">SOP not found.</p> : <SopView sop={sop} />}
    </div>
  );
}
