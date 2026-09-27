import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Operator console" };

// TODO(segment-7): implement operator console
export default function Page() {
  return (
    <>
      <PageHeader title="Operator console" />
      <ComingSoon page="Operator console" segment={7} />
    </>
  );
}
