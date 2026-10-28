import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SEED_PASSWORD = "Password123"; // demo accounts only

interface DeptSeed {
  name: string;
  description: string;
  children?: DeptSeed[];
}

const TREE: DeptSeed[] = [
  {
    name: "Human Resources",
    description: "People, hiring and welfare",
    children: [
      { name: "Recruitment", description: "Hiring and onboarding" },
      { name: "Training & Development", description: "Learning programmes" },
      { name: "Employee Welfare", description: "Wellbeing and benefits" },
    ],
  },
  {
    name: "Operations",
    description: "Day-to-day delivery",
    children: [
      { name: "Field Operations", description: "On-site teams" },
      { name: "Maintenance", description: "Equipment and facilities" },
    ],
  },
  {
    name: "Finance",
    description: "Money and reporting",
    children: [
      { name: "Accounts", description: "Payables and receivables" },
      { name: "Audit", description: "Internal audit" },
    ],
  },
];

const PEOPLE: { fullName: string; email: string; position: string; role: Role; dept: string | null }[] = [
  { fullName: "Admin User", email: "admin@hrflow.test", position: "System Administrator", role: "ADMIN", dept: null },
  { fullName: "Hannah Bello", email: "hr.manager@hrflow.test", position: "HR Manager", role: "HR_MANAGER", dept: "Human Resources" },
  { fullName: "Ruth Adeyemi", email: "ruth@hrflow.test", position: "Recruiter", role: "EMPLOYEE", dept: "Recruitment" },
  { fullName: "Tunde Ojo", email: "tunde@hrflow.test", position: "Recruitment Lead", role: "EMPLOYEE", dept: "Recruitment" },
  { fullName: "Chidi Eze", email: "chidi@hrflow.test", position: "Operations Manager", role: "EMPLOYEE", dept: "Operations" },
  { fullName: "Amaka Obi", email: "amaka@hrflow.test", position: "Field Officer", role: "EMPLOYEE", dept: "Field Operations" },
  { fullName: "Sola Bakare", email: "sola@hrflow.test", position: "Finance Manager", role: "EMPLOYEE", dept: "Finance" },
  { fullName: "Ibrahim Musa", email: "ibrahim@hrflow.test", position: "Accountant", role: "EMPLOYEE", dept: "Accounts" },
];

// department name -> email of its head
const HEADS: Record<string, string> = {
  "Human Resources": "hr.manager@hrflow.test",
  Recruitment: "tunde@hrflow.test",
  Operations: "chidi@hrflow.test",
  Finance: "sola@hrflow.test",
};

async function seedDepartments(
  nodes: DeptSeed[],
  parent: { id: string; path: string[]; depth: number } | null,
  ids: Map<string, string>,
): Promise<void> {
  for (const node of nodes) {
    const depth = parent ? parent.depth + 1 : 0;
    const path = parent ? [parent.id, ...parent.path] : [];
    // Re-running the seed must not create duplicates, so look first.
    let dept = await prisma.department.findFirst({ where: { name: node.name, depth } });
    if (!dept) {
      dept = await prisma.department.create({
        data: { name: node.name, description: node.description, parentId: parent?.id ?? null, path, depth },
      });
    }
    ids.set(node.name, dept.id);
    if (node.children) await seedDepartments(node.children, dept, ids);
  }
}

async function main() {
  const ids = new Map<string, string>();
  await seedDepartments(TREE, null, ids);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const employeeIds = new Map<string, string>();
  for (const p of PEOPLE) {
    const departmentId = p.dept ? ids.get(p.dept) ?? null : null;
    const emp = await prisma.employee.upsert({
      where: { email: p.email },
      update: { departmentId, position: p.position },
      create: {
        fullName: p.fullName,
        email: p.email,
        position: p.position,
        role: p.role,
        passwordHash,
        departmentId,
      },
    });
    employeeIds.set(p.email, emp.id);
  }

  for (const [deptName, email] of Object.entries(HEADS)) {
    await prisma.department.update({
      where: { id: ids.get(deptName)! },
      data: { headId: employeeIds.get(email)! },
    });
  }

  console.log(`Seeded ${ids.size} departments and ${PEOPLE.length} employees.`);
  console.log(`Demo logins use the password: ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());