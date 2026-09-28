import { PageHeader } from "@/components/atlas/page-header";
import { getTradesModel } from "@/server/read/trades";
import { getViewer } from "@/server/viewer";
import { TradesList } from "./_components/trades-list";
export const metadata = { title: "Trades" };
export default async function Page() {
  return (
    <>
      <PageHeader
        title="Trades"
        meta={
          <span className="type-body text-ink-muted">
            Every sale moves through the same steps: signatures, the company's right of first
            refusal, escrow, the register update and release.
          </span>
        }
      />
      <TradesList model={await getTradesModel(await getViewer())} />
    </>
  );
}
