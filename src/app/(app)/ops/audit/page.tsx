import { ComingSoon } from "@/components/atlas/coming-soon";
import { PageHeader } from "@/components/atlas/page-header";

export const metadata = { title: "Audit log" };

// TODO(segment-7): implement audit log
export default function Page() {
  return (
    <>
      <PageHeader title="Audit log" />
      <ComingSoon page="Audit log" segment={7} />
    </>
  );
}
