import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Place a bid" };

// TODO(segment-5): implement place a bid
export default function Page() {
  return (
    <>
      <PageHeader title="Place a bid" />
      <ComingSoon page="Place a bid" segment={5} />
    </>
  );
}
