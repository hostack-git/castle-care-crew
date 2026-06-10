import { createFileRoute, redirect } from "@tanstack/react-router";
import { IS_DEMO } from "@/integrations/hostack/client";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: IS_DEMO ? "/demo" : "/login" }); },
  component: () => null,
});
