import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { SelectField } from "@/components/forms/Fields";
import { Badge, btnSecondary, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { isObjectId, orNotFound } from "@/lib/page-guard";
import { can } from "@/lib/permissions";
import { assignEmployeeAction, updateDepartmentAction } from "@/modules/departments/actions";
import { DepartmentForm } from "@/modules/departments/components/DepartmentForm";
import { flattenTree, getDepartmentBranchIds } from "@/modules/departments/queries";
import { getDepartmentDetail, getDepartmentTree } from "@/modules/departments/service";
import { getEmployeeOptions } from "@/modules/employees/service";

export const metadata = { title: "Department | HRFlow" };

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isObjectId(id)) notFound();

  const user = await requireUser();
  const { department, ancestors, members } = await orNotFound(getDepartmentDetail(user, id));
  const canManage = can(user, "department:manage");

  // Moving a department into its own branch would create a loop, so don't even offer those options.
  // (The server rejects it anyway; this is just a friendlier form.)
  const [tree, branchIds, employees] = await Promise.all([
    getDepartmentTree(),
    canManage ? getDepartmentBranchIds(id) : Promise.resolve([]),
    canManage ? getEmployeeOptions() : Promise.resolve([]),
  ]);
  const parentOptions = flattenTree(tree).filter((o) => !branchIds.includes(o.id));

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href="/departments" className="hover:text-foreground hover:underline">
          Organization
        </Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            <Link href={`/departments/${a.id}`} className="hover:text-foreground hover:underline">
              {a.name}
            </Link>
          </span>
        ))}
        <span aria-hidden="true">/</span>
        <span className="font-medium text-foreground" aria-current="page">
          {department.name}
        </span>
      </nav>

      <PageHeader
        title={department.name}
        description={department.description ?? undefined}
        actions={
          <Link href="/departments" className={btnSecondary}>
            All departments
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Overview">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Department head</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {department.head ? (
                    <Link href={`/employees/${department.head.id}`} className="font-medium text-primary-text hover:underline">
                      {department.head.fullName}
                    </Link>
                  ) : (
                    <span className="text-muted">No head assigned</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Parent department</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {ancestors.length > 0 ? (
                    <Link href={`/departments/${ancestors[ancestors.length - 1].id}`} className="font-medium text-primary-text hover:underline">
                      {ancestors[ancestors.length - 1].name}
                    </Link>
                  ) : (
                    <span className="text-muted">None (top level)</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title={`Sub-departments (${department.children.length})`}>
            {department.children.length === 0 ? (
              <EmptyState title="No sub-departments" />
            ) : (
              <ul className="divide-y divide-border">
                {department.children.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/departments/${c.id}`} className="font-medium text-foreground hover:underline">
                      {c.name}
                    </Link>
                    <Badge tone="gray">{c._count.members} members</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={members ? `Members (${members.length})` : "Members"}>
            {members === null ? (
              <p className="text-sm text-muted">The member list is visible to HR, Admins and members of this department.</p>
            ) : members.length === 0 ? (
              <EmptyState title="No active members" description="Assign employees to this department using the form." />
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      {can(user, "employee:view-all") ? (
                        <Link href={`/employees/${m.id}`} className="font-medium text-foreground hover:underline">
                          {m.fullName}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{m.fullName}</span>
                      )}
                      <p className="text-xs text-muted">{m.position}</p>
                    </div>
                    {department.head?.id === m.id && <Badge tone="green">Head</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {canManage && (
          <div className="space-y-6">
            <Card title="Edit or move">
              <DepartmentForm
                mode="edit"
                action={updateDepartmentAction}
                parentOptions={parentOptions}
                employees={employees}
                department={{
                  id: department.id,
                  name: department.name,
                  description: department.description,
                  parentId: department.parentId,
                  headId: department.headId,
                }}
              />
            </Card>

            <Card title="Assign an employee" description="Moves them into this department.">
              <ActionForm
                action={assignEmployeeAction}
                submitLabel="Assign"
                pendingLabel="Assigning..."
                successMessage="Employee assigned."
                resetOnSuccess
              >
                <input type="hidden" name="departmentId" value={department.id} />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  placeholder="Choose an employee"
                  options={employees.map((e) => ({ value: e.id, label: `${e.fullName} · ${e.position}` }))}
                />
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
