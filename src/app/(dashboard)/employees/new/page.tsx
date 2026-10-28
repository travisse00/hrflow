import Link from "next/link";
import { redirect } from "next/navigation";
import { btnSecondary, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { getDepartmentOptions } from "@/modules/departments/queries";
import { createEmployeeAction } from "@/modules/employees/actions";
import { EmployeeForm } from "@/modules/employees/components/EmployeeForm";

export const metadata = { title: "Add employee | HRFlow" };

export default async function NewEmployeePage() {
  const user = await requireUser();
  if (!can(user, "employee:manage")) redirect("/dashboard");

  const departments = await getDepartmentOptions();

  return (
    <>
      <PageHeader
        title="Add employee"
        description="They can sign in with this email and the temporary password."
        actions={
          <Link href="/employees" className={btnSecondary}>
            Cancel
          </Link>
        }
      />
      <Card>
        <EmployeeForm
          mode="create"
          action={createEmployeeAction}
          departments={departments}
          canAssignRole={can(user, "employee:assign-role")}
        />
      </Card>
    </>
  );
}
