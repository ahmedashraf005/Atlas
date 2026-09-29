"use server";
import * as actions from "@/server/actions/notifications";
export async function markRead(...args: Parameters<typeof actions.markRead>) {
  return actions.markRead(...args);
}
export async function markAllRead(...args: Parameters<typeof actions.markAllRead>) {
  return actions.markAllRead(...args);
}
