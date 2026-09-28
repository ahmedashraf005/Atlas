"use server";
import * as actions from "@/server/actions/bids";
export async function submit(...args: Parameters<typeof actions.submit>) {
  return actions.submit(...args);
}
export async function amend(...args: Parameters<typeof actions.amend>) {
  return actions.amend(...args);
}
export async function withdraw(...args: Parameters<typeof actions.withdraw>) {
  return actions.withdraw(...args);
}
export async function acceptCounter(...args: Parameters<typeof actions.acceptCounter>) {
  return actions.acceptCounter(...args);
}
export async function declineCounter(...args: Parameters<typeof actions.declineCounter>) {
  return actions.declineCounter(...args);
}
