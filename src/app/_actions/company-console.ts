"use server";
import * as actions from "@/server/actions/company-console";
export async function verifyHolding(...args: Parameters<typeof actions.verifyHolding>) {
  return actions.verifyHolding(...args);
}
export async function rejectHolding(...args: Parameters<typeof actions.rejectHolding>) {
  return actions.rejectHolding(...args);
}
export async function decideAccessAction(...args: Parameters<typeof actions.decideAccessAction>) {
  return actions.decideAccessAction(...args);
}
export async function answerQuestion(...args: Parameters<typeof actions.answerQuestion>) {
  return actions.answerQuestion(...args);
}
