import Link from "next/link";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUnderTheHoodModel } from "@/server/read/under-the-hood";
import { getViewer } from "@/server/viewer";
import { MermaidDiagram } from "./_components/mermaid-diagram";
import { SeeIt } from "./_components/see-it";
import { StateMachines } from "./_components/state-machines";
export const metadata = { title: "Under the hood" };
export default async function UnderTheHoodPage() {
  const model = await getUnderTheHoodModel(await getViewer());
  return (
    <>
      <PageHeader
        title="Under the hood"
        meta="How Atlas enforces its rules. Everything on this page is generated from, or links to, the running code."
      />
      <SectionCard title="How a sale works">
        <ol className="list-decimal space-y-3 pl-6 type-body-sm">
          {model.steps.map((s) => (
            <li key={s.text}>
              <Link href={s.href} className="text-atlas-green hover:underline">
                {s.text}
              </Link>
            </li>
          ))}
        </ol>
      </SectionCard>
      <SectionCard title="State machines">
        <StateMachines machines={model.machines} />
      </SectionCard>
      <SectionCard title="Security model" id="security" flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Threat</TableHead>
              <TableHead>Control</TableHead>
              <TableHead>See it</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.controls.map((c) => (
              <TableRow key={c.threat}>
                <TableCell>{c.threat}</TableCell>
                <TableCell className="whitespace-normal min-w-64">{c.control}</TableCell>
                <TableCell>
                  {c.href && "persona" in c && c.persona ? (
                    <SeeIt persona={c.persona} href={c.href} label={c.see} />
                  ) : (
                    c.see || "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
      <SectionCard title="Architecture">
        <MermaidDiagram text={model.architecture} label="Atlas architecture" />
        <ul className="mt-4 list-disc space-y-2 pl-5 type-body-sm">
          {model.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard title="How it was built">
        <p className="type-body-sm">
          Atlas was built in numbered segments, starting with the design system and pure domain
          rules. Each segment added working pages and tests on the same transactional backend.
        </p>
        {model.repoUrl && (
          <div className="mt-3 flex flex-wrap gap-4 type-body-sm">
            <a className="text-atlas-green hover:underline" href={model.repoUrl} rel="noreferrer">
              Public repository
            </a>
            <a
              className="text-atlas-green hover:underline"
              href={model.buildLogUrl ?? undefined}
              rel="noreferrer"
            >
              Build log
            </a>
          </div>
        )}
      </SectionCard>
    </>
  );
}
