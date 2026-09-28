"use server";
import * as actions from "@/server/actions/holdings";
export async function createHolding(...args: Parameters<typeof actions.createHolding>) {
  return actions.createHolding(...args);
}
export async function resubmitHolding(...args: Parameters<typeof actions.resubmitHolding>) {
  return actions.resubmitHolding(...args);
}
export async function createListing(...args: Parameters<typeof actions.createListing>) {
  return actions.createListing(...args);
}
export async function withdrawListing(...args: Parameters<typeof actions.withdrawListing>) {
  return actions.withdrawListing(...args);
}
