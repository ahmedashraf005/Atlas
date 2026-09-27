import { connectDatabase } from "@/server/db/client";
export const createTestDb = () => connectDatabase("pglite://memory");
