import { getDb } from "@/server/db/client";
import { checkDatabase } from "@/server/health";

export async function GET() {
  await checkDatabase(await getDb());
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
