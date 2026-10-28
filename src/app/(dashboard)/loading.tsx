// Shown instantly while any page in (dashboard) is fetching its data on the server.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-border/70" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-border/50" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-border/40" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
