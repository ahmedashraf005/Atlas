import "server-only";
import type { DomainErrorCode } from "@/domain/errors";
import type { PolicyFailure } from "@/domain/policy";
export type ActionErrorCode =
  | DomainErrorCode
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";
export interface ActionError {
  code: ActionErrorCode;
  message: string;
  issues?: { field: string; message: string }[];
  failures?: PolicyFailure[];
  ref?: string;
}
export class ConflictError extends Error {
  constructor() {
    super("Conflict");
    this.name = "ConflictError";
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("Not found");
    this.name = "NotFoundError";
  }
}
export class UnauthenticatedError extends Error {
  constructor() {
    super("Your demo session expired. Reload the page.");
    this.name = "UnauthenticatedError";
  }
}
export class RollbackError extends Error {
  constructor(public readonly error: ActionError) {
    super(error.code);
    this.name = "RollbackError";
  }
}
