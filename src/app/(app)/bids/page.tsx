import { PageHeader } from "@/components/atlas/page-header";
import { getMyBidsModel } from "@/server/read/bids";
import { getViewer } from "@/server/viewer";
import { MyBids } from "./_components/my-bids";
export const metadata = { title: "My bids" };
export default async function Page() {
  return (
    <>
      <PageHeader
        title="My bids"
        meta={
          <span className="type-body text-ink-muted">
            Sealed bids you've placed and their outcome.
          </span>
        }
      />
      <MyBids model={await getMyBidsModel(await getViewer())} />
    </>
  );
}
