"use server";
import * as actions from "@/server/actions/trades";
export async function sign(...args: Parameters<typeof actions.sign>) {
  return actions.sign(...args);
}
export async function waive(...args: Parameters<typeof actions.waive>) {
  return actions.waive(...args);
}
export async function exercise(...args: Parameters<typeof actions.exercise>) {
  return actions.exercise(...args);
}
export async function refuse(...args: Parameters<typeof actions.refuse>) {
  return actions.refuse(...args);
}
export async function markWireSent(...args: Parameters<typeof actions.markWireSent>) {
  return actions.markWireSent(...args);
}
export async function confirmFunds(...args: Parameters<typeof actions.confirmFunds>) {
  return actions.confirmFunds(...args);
}
export async function uploadRegister(...args: Parameters<typeof actions.uploadRegister>) {
  return actions.uploadRegister(...args);
}
export async function approveRelease(...args: Parameters<typeof actions.approveRelease>) {
  return actions.approveRelease(...args);
}
export async function raiseDispute(...args: Parameters<typeof actions.raiseDispute>) {
  return actions.raiseDispute(...args);
}
export async function resolveContinue(...args: Parameters<typeof actions.resolveContinue>) {
  return actions.resolveContinue(...args);
}
export async function resolveCancel(...args: Parameters<typeof actions.resolveCancel>) {
  return actions.resolveCancel(...args);
}
export async function cancel(...args: Parameters<typeof actions.cancel>) {
  return actions.cancel(...args);
}
export async function sendMessage(...args: Parameters<typeof actions.sendMessage>) {
  return actions.sendMessage(...args);
}
