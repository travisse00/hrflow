import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Not found</h1>
      <p className="mt-1 text-sm text-muted">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/dashboard" className={`${btnPrimary} mt-4`}>
        Back to dashboard
      </Link>
    </div>
  );
}
