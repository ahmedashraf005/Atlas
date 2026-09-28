"use server";
import * as actions from "@/server/actions/policy";
export async function updatePolicy(...args: Parameters<typeof actions.updatePolicy>) {
  return actions.updatePolicy(...args);
}
