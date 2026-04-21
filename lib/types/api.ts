export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "TRUCK_CLOSED"
  | "ALREADY_PAID"
  | "INTERNAL";

export type ApiErrorPayload = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};
