import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { Badge, btnSecondary, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { formatDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { isObjectId, orNotFound } from "@/lib/page-guard";
import { setEmployeeStatusAction } from "@/modules/employees/actions";
import { getEmployee } from "@/modules/employees/service";

export const metadata = { title: "Employee | HRFlow" };

const ROLE_LABEL = { ADMIN: "Admin", HR_MANAGER: "HR Manager", EMPLOYEE: "Employee" } as const;

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isObjectId(id)) notFound();

  const user = await requireUser();
  const employee = await orNotFound(getEmployee(user, id));

  const isSelf = employee.id === user.id;
  const canManage = can(user, "employee:manage") && !(employee.role === "ADMIN" && user.role !== "ADMIN");

  return (
    <>
      <PageHeader
        title={employee.fullName}
        description={`${employee.position}${isSelf ? " · This is you" : ""}`}
        actions={
          <>
            {can(user, "employee:view-all") && (
              <Link href="/employees" className={btnSecondary}>
                All employees
              </Link>
            )}
            {canManage && (
              <Link href={`/employees/${employee.id}/edit`} className={btnSecondary}>
                Edit
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profile" className="lg:col-span-2">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label="Email">{employee.email}</Detail>
            <Detail label="Phone">{employee.phone ?? <span className="text-muted">Not provided</span>}</Detail>
            <Detail label="Department">
              {employee.department ? (
                <Link href={`/departments/${employee.department.id}`} className="font-medium text-primary-text hover:underline">
                  {employee.department.name}
                </Link>
              ) : (
                <span className="text-muted">None</span>
              )}
            </Detail>
            <Detail label="Date joined">{formatDay(employee.dateJoined)}</Detail>
            <Detail label="Role">
              <Badge tone={employee.role === "EMPLOYEE" ? "gray" : "green"}>{ROLE_LABEL[employee.role]}</Badge>
            </Detail>
            <Detail label="Status">
              <Badge tone={employee.status === "ACTIVE" ? "green" : "red"}>
                {employee.status === "ACTIVE" ? "Active" : `Inactive${employee.deactivatedAt ? ` since ${formatDay(employee.deactivatedAt)}` : ""}`}
              </Badge>
            </Detail>
            {employee.headedDepartments.length > 0 && (
              <Detail label="Heads">
                {employee.headedDepartments.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ", "}
                    <Link href={`/departments/${d.id}`} className="font-medium text-primary-text hover:underline">
                      {d.name}
                    </Link>
                  </span>
                ))}
              </Detail>
            )}
          </dl>
        </Card>

        {canManage && !isSelf && (
          <Card
            title={employee.status === "ACTIVE" ? "Deactivate account" : "Reactivate account"}
            description={
              employee.status === "ACTIVE"
                ? "They lose access immediately. Their attendance, leave and messages are kept."
                : "Restores their access to the platform."
            }
          >
            <ActionForm
              action={setEmployeeStatusAction}
              submitLabel={employee.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
              pendingLabel="Working..."
              variant={employee.status === "ACTIVE" ? "danger" : "primary"}
              confirmMessage={employee.status === "ACTIVE" ? `Deactivate ${employee.fullName}? They will no longer be able to sign in.` : undefined}
              successMessage="Done."
            >
              <input type="hidden" name="id" value={employee.id} />
              <input type="hidden" name="status" value={employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
