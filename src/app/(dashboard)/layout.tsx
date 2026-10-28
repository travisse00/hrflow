import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { logoutAction } from "@/modules/auth/actions";

const ROLE_LABEL = { ADMIN: "Admin", HR_MANAGER: "HR Manager", EMPLOYEE: "Employee" } as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: no valid, active user = sent back to the login page. This runs for
  // every page inside (dashboard), on top of the middleware check.
  const user = await requireUser();

  // The menu is built from permissions, but hiding a link protects nothing by itself:
  // every page and every action below re-checks on the server.
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/messages", label: "Messages", icon: "messages" },
    { href: "/attendance", label: "Attendance", icon: "attendance" },
    { href: "/leave", label: "Leave", icon: "leave" },
    { href: "/departments", label: "Departments", icon: "departments" },
    can(user, "employee:view-all")
      ? { href: "/employees", label: "Employees", icon: "employees" }
      : { href: `/employees/${user.id}`, label: "My profile", icon: "profile" },
  ];

  return (
    <AppShell
      items={items}
      user={{ fullName: user.fullName, roleLabel: ROLE_LABEL[user.role] }}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
