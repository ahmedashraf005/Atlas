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
import { getDocumentModel } from "@/server/read/company";
import { getViewer } from "@/server/viewer";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; documentId: string }>;
}) {
  const { slug, documentId } = await params;
  const document = await getDocumentModel(await getViewer(), slug, documentId);
  return { title: { absolute: document ? `${document.title} · Atlas` : "Document · Atlas" } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; documentId: string }>;
}) {
  const viewer = await getViewer(),
    { slug, documentId } = await params,
    document = await getDocumentModel(viewer, slug, documentId);
  if (!document) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Discover", href: "/discover" },
          { label: document.company, href: `/companies/${slug}` },
          { label: document.title },
        ]}
        title={document.title}
      />
      <article className="relative overflow-hidden rounded-md border border-line bg-surface p-6 md:p-10">
        <Watermark text={document.watermark} />
        <div className="relative z-10 flex flex-col gap-6">
          {document.heading !== document.title && (
            <h2 className="type-heading-2">{document.heading}</h2>
          )}
          {document.paragraphs.map((p) => (
            <p key={p} className="type-body">
              {p}
            </p>
          ))}
          {document.rows.length > 0 && (
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
                    {row.map((cell, j) => (
                      <TableCell key={`${row[0]}-${document.headers[j]}`}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="type-body-sm text-ink-muted">{document.note}</p>
          <p className="border-t border-line pt-4 type-body-sm text-ink-muted">{document.footer}</p>
        </div>
      </article>
    </div>
  );
}
