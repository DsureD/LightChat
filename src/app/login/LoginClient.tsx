"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

async function readError(response: Response) {
  try {
    const payload = await response.json();
    return payload.error || "请求失败。";
  } catch {
    return "请求失败。";
  }
}

export function LoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码。");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      router.replace("/chat");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 space-y-2">
          <p className="text-sm font-medium text-slate-500">Light Chat</p>
          <h1 className="text-3xl font-semibold tracking-tight">管理员登录</h1>
          <p className="text-sm text-slate-500">登录后配置模型服务商并开始聊天。</p>
        </div>

        <form className="space-y-4" onSubmit={submitLogin}>
          <label className="block space-y-2 text-sm font-medium">
            <span>用户名</span>
            <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" disabled={loading} />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>密码</span>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={loading} />
          </label>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" disabled={loading || !username.trim() || !password.trim()} type="submit">
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
