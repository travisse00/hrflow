import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createDepartmentAction } from "@/modules/departments/actions";
import { DepartmentForm } from "@/modules/departments/components/DepartmentForm";
import { DepartmentTree } from "@/modules/departments/components/DepartmentTree";
import { flattenTree } from "@/modules/departments/queries";
import { getDepartmentTree } from "@/modules/departments/service";
import { getEmployeeOptions } from "@/modules/employees/service";

export const metadata = { title: "Departments | HRFlow" };

export default async function DepartmentsPage() {
  const user = await requireUser();
  const canManage = can(user, "department:manage");

  const [tree, employees] = await Promise.all([getDepartmentTree(), canManage ? getEmployeeOptions() : Promise.resolve([])]);
  const options = flattenTree(tree);

  return (
    <>
      <PageHeader title="Departments" description="Your organisation's structure. Select a department to see its people and sub-departments." />

      <div className={canManage ? "grid gap-6 lg:grid-cols-[1fr_360px]" : ""}>
        <Card>
          {tree.length === 0 ? (
            <EmptyState
              title="No departments yet"
              description={canManage ? "Create the first department using the form." : "An administrator hasn't set up any departments yet."}
            />
          ) : (
            <DepartmentTree nodes={tree} />
          )}
        </Card>

        {canManage && (
          <Card title="New department" description="Leave the parent empty for a top-level department.">
            <DepartmentForm mode="create" action={createDepartmentAction} parentOptions={options} employees={employees} />
          </Card>
        )}
      </div>
    </>
  );
}
