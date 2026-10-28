import { ActionForm } from "@/components/forms/ActionForm";
import { Field, SelectField } from "@/components/forms/Fields";
import { dayKeyFor } from "@/lib/dates";
import type { ActionResult } from "@/lib/errors";
import { optionLabel, type DepartmentOption } from "@/modules/departments/queries";

interface EmployeeFormProps {
  mode: "create" | "edit";
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  departments: DepartmentOption[];
  canAssignRole: boolean;
  employee?: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    position: string;
    role: "ADMIN" | "HR_MANAGER" | "EMPLOYEE";
    dateJoined: Date;
    department: { id: string } | null;
  };
}

const ROLE_OPTIONS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "HR_MANAGER", label: "HR Manager" },
  { value: "ADMIN", label: "Admin" },
];

export function EmployeeForm({ mode, action, departments, canAssignRole, employee }: EmployeeFormProps) {
  return (
    <ActionForm
      action={action}
      submitLabel={mode === "create" ? "Create employee" : "Save changes"}
      pendingLabel="Saving..."
    >
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="fullName" defaultValue={employee?.fullName} autoComplete="off" />
        <Field label="Email" name="email" type="email" defaultValue={employee?.email} autoComplete="off" />
        <Field label="Phone (optional)" name="phone" type="tel" defaultValue={employee?.phone ?? ""} />
        <Field label="Position" name="position" defaultValue={employee?.position} />
        <SelectField
          label="Department"
          name="departmentId"
          placeholder="No department"
          defaultValue={employee?.department?.id ?? ""}
          options={departments.map((d) => ({ value: d.id, label: optionLabel(d) }))}
        />
        <Field
          label="Date joined"
          name="dateJoined"
          type="date"
          defaultValue={employee ? dayKeyFor(employee.dateJoined) : dayKeyFor()}
        />
        {canAssignRole && (
          <SelectField label="Role" name="role" defaultValue={employee?.role ?? "EMPLOYEE"} options={ROLE_OPTIONS} />
        )}
        {mode === "create" && (
          <Field
            label="Temporary password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters, with a number"
          />
        )}
      </div>
    </ActionForm>
  );
}
