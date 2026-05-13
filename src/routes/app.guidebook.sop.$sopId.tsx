import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink } from "lucide-react";
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
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/guidebook">
            <ChevronLeft className="h-4 w-4 mr-1" /> Guidebook
          </Link>
        </Button>
        {sop?.embedUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={sop.embedUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" /> Open in new tab
            </a>
          </Button>
        )}
      </div>

      {!sop ? (
        <p className="text-muted-foreground">SOP not found.</p>
      ) : sop.embedUrl ? (
        <iframe
          src={sop.embedUrl}
          title={sop.title}
          className="w-full rounded-lg bg-background"
          style={{ minHeight: "85vh", border: 0 }}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      ) : (
        <SopView sop={sop} />
      )}
    </div>
  );
}
