import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/breakfast")({
  component: () => <Navigate to="/app/guidebook/sop/$sopId" params={{ sopId: "breakfast" }} replace />,
});
