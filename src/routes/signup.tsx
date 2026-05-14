import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/signup")({ component: SignupRedirect });

function SignupRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/volunteer-access", replace: true });
  }, [navigate]);
  return null;
}
