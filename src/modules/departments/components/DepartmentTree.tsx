import Link from "next/link";
import { Badge } from "@/components/ui";
import type { DepartmentNode } from "../service";

function TreeNode({ node }: { node: DepartmentNode }) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-3 py-2.5 transition hover:bg-soft/50">
        <Link href={`/departments/${node.id}`} className="font-medium text-foreground hover:underline">
          {node.name}
        </Link>
        <Badge tone="gray">
          {node.memberCount} {node.memberCount === 1 ? "member" : "members"}
        </Badge>
        <span className="text-xs text-muted">{node.head ? `Head: ${node.head.fullName}` : "No head assigned"}</span>
      </div>
      {node.children.length > 0 && (
        // The left border + indent is what makes the hierarchy readable at a glance.
        <ul className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-4 sm:ml-6 sm:pl-5">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function DepartmentTree({ nodes }: { nodes: DepartmentNode[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs text-primary-fg">◆</span>
        Organization
      </div>
      <ul className="ml-3 space-y-2 border-l-2 border-border pl-4 sm:ml-4 sm:pl-5">
        {nodes.map((node) => (
          <TreeNode key={node.id} node={node} />
        ))}
      </ul>
    </div>
  );
}
