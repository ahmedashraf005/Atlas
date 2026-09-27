"use server";

import * as actions from "@/server/actions/demo";
// Next requires its module directive before imports. Keep that boundary here so
// every implementation module in src/server still begins with the server-only guard.
export async function switchPersona(...args: Parameters<typeof actions.switchPersona>) {
  return actions.switchPersona(...args);
}
export async function advanceClock(...args: Parameters<typeof actions.advanceClock>) {
  return actions.advanceClock(...args);
}
export async function toggleAutopilot(...args: Parameters<typeof actions.toggleAutopilot>) {
  return actions.toggleAutopilot(...args);
}
export async function setRofrMode(...args: Parameters<typeof actions.setRofrMode>) {
  return actions.setRofrMode(...args);
}
export async function resetSandbox(...args: Parameters<typeof actions.resetSandbox>) {
  return actions.resetSandbox(...args);
}
