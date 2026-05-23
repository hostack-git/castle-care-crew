import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/guidebook")({ component: () => <Outlet /> });
