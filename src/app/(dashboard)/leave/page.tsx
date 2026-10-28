import { ActionForm } from "@/components/forms/ActionForm";
import { Field, SelectField, TextAreaField } from "@/components/forms/Fields";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { dayKeyFor } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { submitLeaveAction } from "@/modules/leave/actions";
import { LeaveList } from "@/modules/leave/components/LeaveList";
import { LeaveReviewForm } from "@/modules/leave/components/LeaveReviewForm";
import { listLeaveForReview, listMyLeave } from "@/modules/leave/service";

export const metadata = { title: "Leave | HRFlow" };

const TYPE_OPTIONS = [
  { value: "ANNUAL", label: "Annual leave" },
  { value: "SICK", label: "Sick leave" },
  { value: "CASUAL", label: "Casual leave" },
  { value: "MATERNITY", label: "Maternity leave" },
  { value: "PATERNITY", label: "Paternity leave" },
  { value: "UNPAID", label: "Unpaid leave" },
];

export default async function LeavePage() {
  const user = await requireUser();
  const isReviewer = can(user, "leave:review");

  const [mine, pending, decided] = await Promise.all([
    listMyLeave(user),
    isReviewer ? listLeaveForReview(user, "PENDING") : Promise.resolve([]),
    isReviewer ? listLeaveForReview(user, "DECIDED") : Promise.resolve([]),
  ]);

  // You can't review your own request, so don't show yourself an approve button.
  const reviewable = pending.filter((r) => r.requester.id !== user.id);

  return (
    <>
      <PageHeader title="Leave" description="Request time off and follow its status." />

      <div className="space-y-6">
        {isReviewer && (
          <Card
            title={`Awaiting your decision (${reviewable.length})`}
            description="Oldest requests first. Every decision is recorded in the audit trail."
          >
            <LeaveList
              requests={reviewable}
              showRequester
              emptyTitle="No pending requests. You're all caught up."
              renderActions={(r) => <LeaveReviewForm requestId={r.id} />}
            />
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card title="Request leave">
            <ActionForm
              action={submitLeaveAction}
              submitLabel="Submit request"
              pendingLabel="Submitting..."
              successMessage="Request submitted. You'll see the decision here."
              resetOnSuccess
            >
              <SelectField label="Leave type" name="type" options={TYPE_OPTIONS} defaultValue="ANNUAL" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Field label="Start date" name="startDate" type="date" defaultValue={dayKeyFor()} />
                <Field label="End date" name="endDate" type="date" defaultValue={dayKeyFor()} />
              </div>
              <TextAreaField label="Reason" name="reason" placeholder="A short explanation for your manager" />
            </ActionForm>
          </Card>

          <Card title="My requests">
            <LeaveList requests={mine} emptyTitle="You haven't requested any leave yet." />
          </Card>
        </div>

        {isReviewer && (
          <Card title="Recent decisions" description="The latest approved and rejected requests across the organisation.">
            <LeaveList requests={decided} showRequester emptyTitle="No decisions yet." />
          </Card>
        )}
      </div>
    </>
  );
}
