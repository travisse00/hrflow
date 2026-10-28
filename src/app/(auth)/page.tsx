import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginForm } from "@/modules/auth/components/LoginForm";

export const metadata = { title: "Sign in | HRFlow" };

// This is the "/" page: login IS the home page.
export default async function LoginPage() {
  // Already signed in? Skip the form. (Done here, not in middleware, because only
  // the database can say whether the account is still active.)
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Sign in to your HRFlow account.</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-medium text-primary-text hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
