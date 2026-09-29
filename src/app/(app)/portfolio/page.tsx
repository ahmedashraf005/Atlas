import Link from "next/link";
import { EmptyState } from "@/components/atlas/empty-state";
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
import { getPortfolioModel } from "@/server/read/portfolio";
import { getViewer } from "@/server/viewer";
export const metadata = { title: "Portfolio" };
export default async function PortfolioPage() {
  const rows = await getPortfolioModel(await getViewer());
  return (
    <>
      <PageHeader title="Portfolio" meta="Shares acquired through Atlas trades." />
      <SectionCard title="Your shares" flush>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {["Company", "Share class", "Quantity", "Acquired", "Source trades"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.company}</TableCell>
                  <TableCell>{r.shareClass}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell>{r.acquired}</TableCell>
                  <TableCell>
                    {r.sources.map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        className="mr-3 text-atlas-green hover:underline"
                      >
                        {s.ref}
                      </Link>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="Shares you buy on Atlas appear here." />
        )}
      </SectionCard>
    </>
  );
}
