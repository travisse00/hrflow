import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { btnSecondary, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { isObjectId, orNotFound } from "@/lib/page-guard";
import { can } from "@/lib/permissions";
import { getDepartmentOptions } from "@/modules/departments/queries";
import { updateEmployeeAction } from "@/modules/employees/actions";
import { EmployeeForm } from "@/modules/employees/components/EmployeeForm";
import { getEmployee } from "@/modules/employees/service";

export const metadata = { title: "Edit employee | HRFlow" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isObjectId(id)) notFound();

  const user = await requireUser();
  if (!can(user, "employee:manage")) redirect(`/employees/${id}`);

  const [employee, departments] = await Promise.all([orNotFound(getEmployee(user, id)), getDepartmentOptions()]);
  if (employee.role === "ADMIN" && user.role !== "ADMIN") redirect(`/employees/${id}`);

  return (
    <>
      <PageHeader
        title={`Edit ${employee.fullName}`}
        actions={
          <Link href={`/employees/${employee.id}`} className={btnSecondary}>
            Cancel
          </Link>
        }
      />
      <Card>
        <EmployeeForm
          mode="edit"
          action={updateEmployeeAction}
          departments={departments}
          canAssignRole={can(user, "employee:assign-role") && employee.id !== user.id}
          employee={employee}
        />
      </Card>
    </>
  );
}
