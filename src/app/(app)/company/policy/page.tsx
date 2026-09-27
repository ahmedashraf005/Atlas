import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Transfer policy" };

// TODO(segment-7): implement transfer policy
export default function Page() {
  return (
    <>
      <PageHeader title="Transfer policy" />
      <ComingSoon page="Transfer policy" segment={7} />
    </>
  );
}
