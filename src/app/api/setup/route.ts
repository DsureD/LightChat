import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { jsonError, jsonOk, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userCount = await prisma.user.count();
  return jsonOk({ initialized: userCount > 0 });
}

export async function POST(request: Request) {
  try {
    const userCount = await prisma.user.count();

    if (userCount > 0) {
      return jsonError("系统已经初始化。", 409);
    }

    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || password.length < 8) {
      return jsonError("请输入用户名，并设置至少 8 位密码。", 400);
    }

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(password, 12),
        role: "ADMIN"
      },
      select: { id: true, username: true, role: true }
    });

    const response = NextResponse.json({ user });
    setSessionCookie(
      response,
      createSessionToken({
        userId: user.id,
        username: user.username,
        role: user.role
      })
    );
    return response;
  } catch (error) {
    return routeError(error);
  }
}
