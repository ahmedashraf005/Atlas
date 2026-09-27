import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Discover" };

// TODO(segment-3): implement discover
export default function Page() {
  return (
    <>
      <PageHeader title="Discover" />
      <ComingSoon page="Discover" segment={3} />
    </>
  );
}
