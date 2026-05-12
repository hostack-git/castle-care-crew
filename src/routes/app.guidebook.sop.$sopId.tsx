import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ExternalLink, ListChecks, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SopView } from "@/components/SopView";
import { getSop } from "@/lib/sops";

export const Route = createFileRoute("/app/guidebook/sop/$sopId")({
  component: SopPage,
});

function SopPage() {
  const { sopId } = useParams({ from: "/app/guidebook/sop/$sopId" });
  const sop = getSop(sopId);
  const [tab, setTab] = useState<string>("checklist");

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/guidebook">
          <ChevronLeft className="h-4 w-4 mr-1" /> Guidebook
        </Link>
      </Button>

      {!sop ? (
        <p className="text-muted-foreground">SOP not found.</p>
      ) : sop.embedUrl ? (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="checklist">
                <ListChecks className="h-4 w-4 mr-1.5" /> Checklist
              </TabsTrigger>
              <TabsTrigger value="interactive">
                <MonitorPlay className="h-4 w-4 mr-1.5" /> Interactive guide
              </TabsTrigger>
            </TabsList>
            <Button asChild variant="outline" size="sm">
              <a href={sop.embedUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" /> Open in new tab
              </a>
            </Button>
          </div>

          <TabsContent value="checklist" className="mt-0">
            <SopView sop={sop} />
          </TabsContent>

          <TabsContent value="interactive" className="mt-0">
            <div className="rounded-lg border overflow-hidden bg-background">
              <iframe
                src={sop.embedUrl}
                title={`${sop.title} — interactive guide`}
                className="w-full h-[calc(100vh-220px)] min-h-[600px] border-0"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <SopView sop={sop} />
      )}
    </div>
  );
}
