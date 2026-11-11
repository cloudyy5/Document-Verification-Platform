// Component harness adapter only; actual Next navigation is not tested here.
import type { ComponentProps } from "react";
export default function HarnessLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
