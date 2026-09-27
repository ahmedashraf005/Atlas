import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Listing" };

// TODO(segment-5): implement listing
export default function Page() {
  return (
    <>
      <PageHeader title="Listing" />
      <ComingSoon page="Listing" segment={5} />
    </>
  );
}
