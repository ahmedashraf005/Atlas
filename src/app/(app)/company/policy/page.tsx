import { notFound } from "next/navigation";
import { PageHeader } from "@/components/atlas/page-header";
import { getPolicyModel } from "@/server/read/policy";
import { getViewer } from "@/server/viewer";
import { PolicyForm } from "./_components/policy-form";
export const metadata = { title: "Transfer policy" };
export default async function Page() {
  const model = await getPolicyModel(await getViewer());
  if (!model) notFound();
  return (
    <>
      <PageHeader
        title="Transfer policy"
        breadcrumbs={[{ label: model.name, href: "/company" }, { label: "Transfer policy" }]}
        meta={
          <p className="type-body text-ink-muted">
            The rules Atlas enforces for your shareholders and buyers.
          </p>
        }
      />
      <PolicyForm model={model} />
    </>
  );
}
