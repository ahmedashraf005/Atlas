import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Trade room" };

// TODO(segment-6): implement trade room
export default function Page() {
  return (
    <>
      <PageHeader title="Trade room" />
      <ComingSoon page="Trade room" segment={6} />
    </>
  );
}
