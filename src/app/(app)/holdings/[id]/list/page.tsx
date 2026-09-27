import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Create listing" };

// TODO(segment-4): implement create listing
export default function Page() {
  return (
    <>
      <PageHeader title="Create listing" />
      <ComingSoon page="Create listing" segment={4} />
    </>
  );
}
