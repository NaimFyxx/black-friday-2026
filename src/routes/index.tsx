import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Black Friday 2026" },
      { name: "description", content: "Black Friday 2026" },
      { property: "og:title", content: "Black Friday 2026" },
      { property: "og:description", content: "Black Friday 2026" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-5xl font-semibold tracking-tight text-foreground">Black Friday 2026</h1>
      <p className="mt-4 text-base text-muted-foreground">Coming soon — stay tuned for our best deals.</p>
    </main>
  );
}
