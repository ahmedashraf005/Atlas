"use server";
import * as actions from "@/server/actions/company";
export async function requestAccess(...args: Parameters<typeof actions.requestAccess>) {
  return actions.requestAccess(...args);
}
export async function askQuestion(...args: Parameters<typeof actions.askQuestion>) {
  return actions.askQuestion(...args);
}
