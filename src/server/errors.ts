import "server-only";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}
