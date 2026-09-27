import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Under the hood" };

// TODO(segment-8): implement under the hood
export default function Page() {
  return (
    <>
      <PageHeader title="Under the hood" />
      <ComingSoon page="Under the hood" segment={8} />
    </>
  );
}
