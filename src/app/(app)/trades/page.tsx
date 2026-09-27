import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Trades" };

// TODO(segment-6): implement trades
export default function Page() {
  return (
    <>
      <PageHeader title="Trades" />
      <ComingSoon page="Trades" segment={6} />
    </>
  );
}
