import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/chat");
  }

  return <AdminClient username={user.username} />;
}
