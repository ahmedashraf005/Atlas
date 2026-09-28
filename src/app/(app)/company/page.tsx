import { BadgeCheck, FileText, HelpCircle, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Deadline } from "@/components/atlas/deadline";
import { EmptyState } from "@/components/atlas/empty-state";
import { Figure } from "@/components/atlas/figure";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Button } from "@/components/ui/button";
import { getCompanyConsoleModel } from "@/server/read/consoles";
import { getViewer } from "@/server/viewer";
import { Activity } from "./_components/activity";
import { AnswerForm, DecisionControl } from "./_components/decision-control";
export const metadata = { title: "Company console" };
const icons = {
  rofr: ShieldCheck,
  register: FileText,
  holding: BadgeCheck,
  access: Users,
  question: HelpCircle,
};
export default async function Page() {
  const model = await getCompanyConsoleModel(await getViewer());
  if (!model) notFound();
  return (
    <>
      <PageHeader
        title={model.name}
        meta={
          <p className="type-body text-ink-muted">
            Company console · you approve every transfer of your shares on Atlas
          </p>
        }
        actions={
          <Button variant="secondary" asChild>
            <Link href={`/companies/${model.slug}`}>View public page</Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {model.figures.map((f) => (
          <Figure key={f.label} {...f} />
        ))}
      </div>
      <SectionCard title="Decisions waiting on you" aside="Oldest deadline first">
        {!model.decisions.length ? (
          <>
            <EmptyState title="Nothing is waiting on you." />
            {model.autopilot && (
              <p className="type-body-sm text-ink-muted">
                With auto-pilot on, the company's decisions are made automatically while you play
                other roles.
              </p>
            )}
          </>
        ) : (
          <div className="divide-y divide-line">
            {model.decisions.map((item, index) => {
              const Icon = icons[item.kind];
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row"
                >
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    className="shrink-0 text-ink-muted"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 flex flex-col gap-2">
                    <h3 className="type-title">{item.title}</h3>
                    <p className="type-body-sm break-words">
                      {item.detail}
                      {item.deadline && (
                        <>
                          {" "}
                          · decide by <Deadline at={item.deadline} now={model.now} />
                        </>
                      )}
                    </p>
                    {item.kind === "access" && (
                      <StatusBadge tone={item.policyOk ? "success" : "danger"}>
                        {item.policyOk ? "Meets your transfer policy" : item.failures.join(" ")}
                      </StatusBadge>
                    )}
                    {item.kind === "question" && (
                      <AnswerForm questionId={item.id} primary={index === 0} />
                    )}
                  </div>
                  <div className="flex flex-wrap items-start gap-3">
                    {item.href && (
                      <Button variant={index === 0 ? "primary" : "secondary"} size="sm" asChild>
                        <Link href={item.href}>Open trade</Link>
                      </Button>
                    )}
                    {item.kind === "holding" && (
                      <>
                        <DecisionControl
                          action="verifyHolding"
                          values={{ holdingId: item.id }}
                          label="Verify"
                          primary={index === 0}
                          confirmation={item.confirmation}
                        />
                        <DecisionControl
                          action="rejectHolding"
                          values={{ holdingId: item.id }}
                          label="Reject holding"
                          reason
                        />
                      </>
                    )}
                    {item.kind === "access" && (
                      <>
                        <DecisionControl
                          action="decideAccess"
                          values={{
                            companyId: item.companyId,
                            buyerId: item.buyerId,
                            decision: "approve",
                          }}
                          label="Approve"
                          primary={index === 0}
                          disabled={!item.policyOk}
                        />
                        <DecisionControl
                          action="decideAccess"
                          values={{
                            companyId: item.companyId,
                            buyerId: item.buyerId,
                            decision: "deny",
                          }}
                          label="Deny"
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
      <SectionCard title="Recent activity" flush>
        <Activity items={model.activity} />
      </SectionCard>
    </>
  );
}
