import Link from "next/link";
import { btnSecondary, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { NewConversationForm } from "@/modules/messaging/components/NewConversationForm";
import { getComposeOptions } from "@/modules/messaging/service";

export const metadata = { title: "New message | HRFlow" };

export default async function NewMessagePage() {
  const user = await requireUser();
  const { employees, departments, actFor } = await getComposeOptions(user);

  return (
    <>
      <PageHeader
        title="New message"
        actions={
          <Link href="/messages" className={`${btnSecondary} lg:hidden`}>
            Back
          </Link>
        }
      />
      <Card>
        <NewConversationForm employees={employees} departments={departments} actFor={actFor} />
      </Card>
    </>
  );
}
