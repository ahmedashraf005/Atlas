import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Company" };

// TODO(segment-3): implement company
export default function Page() {
  return (
    <>
      <PageHeader title="Company" />
      <ComingSoon page="Company" segment={3} />
    </>
  );
}
