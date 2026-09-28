"use server";
import * as actions from "@/server/actions/audit";
export async function verify(...args: Parameters<typeof actions.verify>) {
  return actions.verify(...args);
}
export async function tamper(...args: Parameters<typeof actions.tamper>) {
  return actions.tamper(...args);
}
