import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "My bids" };

// TODO(segment-5): implement my bids
export default function Page() {
  return (
    <>
      <PageHeader title="My bids" />
      <ComingSoon page="My bids" segment={5} />
    </>
  );
}
