import { redirect } from "next/navigation";

/**
 * The application has no separate landing page: the dashboard is the answer
 * to "how are our finances right now?", so the root simply goes there.
 */
export default function RootPage() {
  redirect("/dashboard");
}
