import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { RegisterForm } from "@/modules/auth/components/RegisterForm";

export const metadata = { title: "Create account | HRFlow" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted">It only takes a minute.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/" className="font-medium text-primary-text hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
