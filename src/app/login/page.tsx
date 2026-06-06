import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginClient } from "./LoginClient";

export default async function LoginPage() {
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    redirect("/setup");
  }

  const user = await getSessionUser();

  if (user) {
    redirect("/chat");
  }

  return <LoginClient />;
}
