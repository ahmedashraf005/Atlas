import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Holdings" };

// TODO(segment-4): implement holdings
export default function Page() {
  return (
    <>
      <PageHeader title="Holdings" />
      <ComingSoon page="Holdings" segment={4} />
    </>
  );
}
