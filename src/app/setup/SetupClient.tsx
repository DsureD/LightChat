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

export function SetupClient() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      router.replace("/admin");
      router.refresh();
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "初始化失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 space-y-2">
          <p className="text-sm font-medium text-slate-500">首次启动</p>
          <h1 className="text-3xl font-semibold tracking-tight">创建管理员账号</h1>
          <p className="text-sm text-slate-500">系统只允许在无用户时初始化第一个管理员。</p>
        </div>

        <form className="space-y-4" onSubmit={submitSetup}>
          <label className="block space-y-2 text-sm font-medium">
            <span>用户名</span>
            <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>密码</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="至少 8 位"
            />
          </label>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "创建中..." : "创建并进入后台"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
