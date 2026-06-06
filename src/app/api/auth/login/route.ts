import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return jsonError("请输入用户名和密码。", 400);
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return jsonError("用户名或密码错误。", 401);
    }

    const publicUser = { id: user.id, username: user.username, role: user.role };
    const response = NextResponse.json({ user: publicUser });
    setSessionCookie(
      response,
      createSessionToken({
        userId: publicUser.id,
        username: publicUser.username,
        role: publicUser.role
      })
    );
    return response;
  } catch (error) {
    return routeError(error);
  }
}
