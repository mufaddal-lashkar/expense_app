import { redirect } from "next/navigation";

// Root always redirects — actual auth check happens in (app)/layout.tsx
export default function RootPage() {
  redirect("/dashboard");
}