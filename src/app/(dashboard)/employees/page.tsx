import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, btnPrimary, btnSecondary, Card, EmptyState, inputClass, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { formatDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { firstParam, type SearchParams } from "@/lib/search-params";
import { employeeListQuerySchema, type EmployeeListQuery } from "@/lib/validation/employee";
import { getDepartmentOptions, optionLabel } from "@/modules/departments/queries";
import { listEmployees } from "@/modules/employees/service";

export const metadata = { title: "Employees | HRFlow" };

const ROLE_LABEL = { ADMIN: "Admin", HR_MANAGER: "HR Manager", EMPLOYEE: "Employee" } as const;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  // Regular employees have no directory: they get their own profile instead.
  if (!can(user, "employee:view-all")) redirect(`/employees/${user.id}`);

  const sp = await searchParams;
  const parsed = employeeListQuerySchema.safeParse({
    q: firstParam(sp.q) || undefined,
    department: firstParam(sp.department) || undefined,
    status: firstParam(sp.status) || undefined,
    role: firstParam(sp.role) || undefined,
    page: firstParam(sp.page) || 1,
  });
  const fallback: EmployeeListQuery = { page: 1 }; // a hand-edited bad URL just shows the unfiltered list
  const query = parsed.success ? parsed.data : fallback;

  const [{ items, total, page, pages }, departments] = await Promise.all([
    listEmployees(user, query),
    getDepartmentOptions(),
  ]);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.department) params.set("department", query.department);
    if (query.status) params.set("status", query.status);
    if (query.role) params.set("role", query.role);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/employees?${qs}` : "/employees";
  };
  const filtered = Boolean(query.q || query.department || query.status || query.role);

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${total} ${total === 1 ? "person" : "people"}${filtered ? " match your filters" : " in the organisation"}`}
        actions={
          can(user, "employee:manage") && (
            <Link href="/employees/new" className={btnPrimary}>
              Add employee
            </Link>
          )
        }
      />

      <Card className="mb-6">
        {/* A plain GET form: the filters live in the URL, so results are shareable and bookmarkable. */}
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr_auto]">
          <input name="q" defaultValue={query.q ?? ""} placeholder="Search name, email or position" aria-label="Search" className={inputClass} />
          <select name="department" defaultValue={query.department ?? ""} aria-label="Department" className={inputClass}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {optionLabel(d)}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={query.status ?? ""} aria-label="Status" className={inputClass}>
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select name="role" defaultValue={query.role ?? ""} aria-label="Role" className={inputClass}>
            <option value="">Any role</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="HR_MANAGER">HR Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary}>
              Filter
            </button>
            {filtered && (
              <Link href="/employees" className={btnSecondary}>
                Clear
              </Link>
            )}
          </div>
        </form>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title={filtered ? "No employees match your search" : "No employees yet"}
          description={filtered ? "Try a different name or clear the filters." : "Add your first employee to get started."}
          action={
            filtered ? (
              <Link href="/employees" className={btnSecondary}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-soft/50">
                  <td className="px-4 py-3">
                    <Link href={`/employees/${e.id}`} className="font-medium text-foreground hover:underline">
                      {e.fullName}
                    </Link>
                    <p className="text-xs text-muted">{e.email}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground">{e.position}</td>
                  <td className="px-4 py-3 text-foreground">{e.department?.name ?? <span className="text-muted">None</span>}</td>
                  <td className="px-4 py-3">
                    <Badge tone={e.role === "EMPLOYEE" ? "gray" : "green"}>{ROLE_LABEL[e.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={e.status === "ACTIVE" ? "green" : "red"}>{e.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDay(e.dateJoined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className={btnSecondary}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={pageHref(page + 1)} className={btnSecondary}>
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
