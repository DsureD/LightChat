import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    redirect("/setup");
  }

  const user = await getSessionUser();
  redirect(user ? "/chat" : "/login");
}
