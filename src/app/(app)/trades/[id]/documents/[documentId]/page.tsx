import { notFound } from "next/navigation";
import { PageHeader } from "@/components/atlas/page-header";
import { Watermark } from "@/components/atlas/watermark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTradeDocumentModel } from "@/server/read/trades";
import { getViewer } from "@/server/viewer";
export const metadata = { title: "Trade document" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const { id, documentId } = await params,
    document = await getTradeDocumentModel(await getViewer(), id, documentId);
  if (!document) notFound();
  return (
    <div className="flex flex-col gap-6 min-w-0">
      <PageHeader
        breadcrumbs={[
          { label: "Trades", href: "/trades" },
          { label: document.ref, href: `/trades/${id}` },
          { label: document.title },
        ]}
        title={document.title}
      />
      <article className="relative overflow-hidden rounded-md border border-line bg-surface p-6 md:p-10">
        <Watermark
          text={`Confidential · ${document.watermark.handle} · ${document.watermark.time}`}
        />
        <div className="relative z-10 flex flex-col gap-6">
          {document.paragraphs.map((p) => (
            <p key={p} className="type-body break-words">
              {p}
            </p>
          ))}
          {!!document.rows.length && (
            <Table>
              <TableHeader>
                <TableRow>
                  {document.headers.map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {document.rows.map((row) => (
                  <TableRow key={row[0]}>
                    {row.map((cell, i) => (
                      <TableCell key={document.headers[i]}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="type-body-sm text-ink-muted">Fictional document for demonstration only.</p>
          <p className="border-t border-line pt-4 type-body-sm text-ink-muted">
            Watermarked for {document.watermark.handle} on {document.watermark.time}. Sharing this
            document breaches the NDA.
          </p>
        </div>
      </article>
    </div>
  );
}
