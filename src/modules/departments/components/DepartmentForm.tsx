import { ActionForm } from "@/components/forms/ActionForm";
import { Field, SelectField, TextAreaField } from "@/components/forms/Fields";
import type { ActionResult } from "@/lib/errors";
import { optionLabel, type DepartmentOption } from "../queries";

interface DepartmentFormProps {
  mode: "create" | "edit";
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  parentOptions: DepartmentOption[]; // for edit: already excludes the department's own branch
  employees: { id: string; fullName: string; position: string }[];
  department?: { id: string; name: string; description: string | null; parentId: string | null; headId: string | null };
}

export function DepartmentForm({ mode, action, parentOptions, employees, department }: DepartmentFormProps) {
  return (
    <ActionForm
      action={action}
      submitLabel={mode === "create" ? "Create department" : "Save changes"}
      pendingLabel="Saving..."
      successMessage={mode === "edit" ? "Department updated." : "Department created."}
      resetOnSuccess={mode === "create"}
    >
      {department && <input type="hidden" name="id" value={department.id} />}
      <Field label="Name" name="name" defaultValue={department?.name} />
      <TextAreaField label="Description (optional)" name="description" defaultValue={department?.description ?? ""} rows={2} />
      <SelectField
        label={mode === "edit" ? "Parent department (change to move it)" : "Parent department"}
        name="parentId"
        placeholder="None (top level)"
        defaultValue={department?.parentId ?? ""}
        options={parentOptions.map((d) => ({ value: d.id, label: optionLabel(d) }))}
      />
      <SelectField
        label="Department head"
        name="headId"
        placeholder="No head assigned"
        defaultValue={department?.headId ?? ""}
        options={employees.map((e) => ({ value: e.id, label: `${e.fullName} · ${e.position}` }))}
      />
    </ActionForm>
  );
}
