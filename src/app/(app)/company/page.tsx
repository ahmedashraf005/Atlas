import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Company console" };

// TODO(segment-7): implement company console
export default function Page() {
  return (
    <>
      <PageHeader title="Company console" />
      <ComingSoon page="Company console" segment={7} />
    </>
  );
}
