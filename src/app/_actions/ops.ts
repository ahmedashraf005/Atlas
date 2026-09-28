"use server";
import * as actions from "@/server/actions/ops";
export async function approveListing(...args: Parameters<typeof actions.approveListing>) {
  return actions.approveListing(...args);
}
export async function rejectListing(...args: Parameters<typeof actions.rejectListing>) {
  return actions.rejectListing(...args);
}
