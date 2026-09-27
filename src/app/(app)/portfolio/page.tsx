import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Portfolio" };

// TODO(segment-8): implement portfolio
export default function Page() {
  return (
    <>
      <PageHeader title="Portfolio" />
      <ComingSoon page="Portfolio" segment={8} />
    </>
  );
}
