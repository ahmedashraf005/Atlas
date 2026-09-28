"use server";
import * as actions from "@/server/actions/listings";
export async function counter(...args: Parameters<typeof actions.counter>) {
  return actions.counter(...args);
}
export async function acceptSelected(...args: Parameters<typeof actions.acceptSelected>) {
  return actions.acceptSelected(...args);
}
export async function declineAll(...args: Parameters<typeof actions.declineAll>) {
  return actions.declineAll(...args);
}
