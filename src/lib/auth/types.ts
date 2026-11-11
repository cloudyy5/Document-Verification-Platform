export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<
    Record<"fullName" | "email" | "password" | "confirmPassword", string>
  >;
};
