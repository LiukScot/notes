import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-medium" style={{ color: "var(--color-text-secondary)" }}>
          Select a page or create a new one
        </h2>
      </div>
    </div>
  );
}
