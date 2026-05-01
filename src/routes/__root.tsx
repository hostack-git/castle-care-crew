import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { I18nProvider } from "@/lib/i18n";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Torridon Volunteer Hub" },
      {
        name: "description",
        content:
          "Onboarding, tasks, calendar, guidebook and community for Torridon House volunteers — Scottish Highlands.",
      },
      { name: "author", content: "Torridon House" },
      { property: "og:title", content: "Torridon Volunteer Hub" },
      {
        property: "og:description",
        content: "Where Torridon volunteers organise their week and share adventures.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Torridon Volunteer Hub" },
      { name: "description", content: "Haven Hub centralizes volunteer management for international accommodations, streamlining onboarding, tasks, and communication." },
      { property: "og:description", content: "Haven Hub centralizes volunteer management for international accommodations, streamlining onboarding, tasks, and communication." },
      { name: "twitter:description", content: "Haven Hub centralizes volunteer management for international accommodations, streamlining onboarding, tasks, and communication." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4f1ea4be-fca2-45de-93ac-86cbe81dd9d4/id-preview-83b16467--4a1e4c77-89b3-4432-955d-de2ed62005cc.lovable.app-1776978184225.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4f1ea4be-fca2-45de-93ac-86cbe81dd9d4/id-preview-83b16467--4a1e4c77-89b3-4432-955d-de2ed62005cc.lovable.app-1776978184225.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Outlet />
        <Toaster richColors closeButton />
      </AuthProvider>
    </I18nProvider>
  );
}
