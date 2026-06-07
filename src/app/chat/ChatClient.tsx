"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronDown, Copy, LogOut, MessageSquare, PanelLeftClose, PanelLeftOpen, PencilLine, Plus, RefreshCcw, Send, Settings, Sparkles, Square, Trash2 } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useConfirm } from "@/components/ConfirmDialog";
import type { ChatMessageDto, ConversationDto, PublicModel } from "@/lib/types";

type LocalMessage = ChatMessageDto & { pending?: boolean };

type StreamEvent = {
  eventName: string;
  data: Record<string, unknown>;
};

type ModelGroup = {
  providerId: string;
  providerName: string;
  models: PublicModel[];
};

async function readError(response: Response) {
  try {
    const payload = await response.json();
    return payload.error || "请求失败。";
  } catch {
    return "请求失败。";
  }
}

function nowIsoString() {
  return new Date().toISOString();
}

function localMessage(role: string, content: string): LocalMessage {
  return {
    id: `local-${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: nowIsoString(),
    pending: true
  };
}

function parseStreamEvent(block: string): StreamEvent | null {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();

    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return { eventName, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return { eventName, data: { content: dataLines.join("\n") } };
  }
}

function groupedModels(models: PublicModel[]) {
  const groups = new Map<string, ModelGroup>();

  for (const model of models) {
    const providerId = model.providerId;
    const providerName = model.providerName || "未命名服务商";
    const group = groups.get(providerId);

    if (group) {
      group.models.push(model);
    } else {
      groups.set(providerId, { providerId, providerName, models: [model] });
    }
  }

  return Array.from(groups.values());
}

function scrollElementIntoView(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  element.scrollIntoView({ block: "end" });
}

function formatDateShort(dateString: string) {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

function Avatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
      <Sparkles className="h-[18px] w-[18px]" />
    </div>
  );
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace(/language-/, "") || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper group relative my-3">
      <div className="flex items-center justify-between rounded-t-lg bg-[#2d2d2d] px-3 py-1.5">
        <span className="text-xs text-gray-400">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 transition hover:bg-white/10 hover:text-gray-200"
          title="复制代码"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block-pre !m-0 !rounded-t-none !rounded-b-lg !border-0">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function MessageBubble({
  message,
  onEdit,
  onRegenerate,
  onCopy
}: {
  message: LocalMessage;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onCopy?: (content: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isUser = message.role === "user";

  // 图片加载失败时降级到 base64
  const imageSrc = (!imgError && message.imageUrl) || (message.imageBase64 ? `data:image/png;base64,${message.imageBase64}` : "");
  // 下载源也要跟随降级逻辑
  const downloadSrc = (!imgError && message.imageUrl) || (message.imageBase64 ? `data:image/png;base64,${message.imageBase64}` : "");

  const handleEditSubmit = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(message.id, trimmed);
      setIsEditing(false);
    }
  };

  const handleCopy = () => {
    if (onCopy) {
      onCopy(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isUser) {
    return (
      <div className="group flex animate-fade-in-up justify-end">
        <div className="relative max-w-[82%]">
          {!isEditing ? (
            <>
              <div className="rounded-2xl rounded-br-md bg-bubble px-4 py-2.5 text-[15px] leading-7 text-ink">
                <div className="prose-chat whitespace-pre-wrap break-words">{message.content}</div>
              </div>
              <div className="mt-1 flex items-center justify-end gap-1">
                {!message.pending && onEdit ? (
                  <button
                    onClick={() => {
                      setEditContent(message.content);
                      setIsEditing(true);
                    }}
                    className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-ink/[0.06] hover:text-ink group-hover:opacity-100"
                    title="编辑"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {!message.pending && onCopy ? (
                  <button
                    onClick={handleCopy}
                    className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-ink/[0.06] hover:text-ink group-hover:opacity-100"
                    title={copied ? "已复制" : "复制"}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border-2 border-accent/40 bg-card p-3">
              <textarea
                className="w-full resize-none border-0 bg-transparent text-[15px] leading-7 text-ink outline-none"
                rows={3}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEditSubmit();
                  }
                  if (e.key === "Escape") {
                    setIsEditing(false);
                  }
                }}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleEditSubmit}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition hover:bg-accent/90"
                >
                  发送
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/[0.04]"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex animate-fade-in-up gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {message.modelName ? (
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent/60" />
            {message.modelName}
          </p>
        ) : null}
        {imageSrc ? (
          <div className="mb-3 space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="max-h-[32rem] rounded-2xl border border-line object-contain"
              src={imageSrc}
              alt={message.content || "generated image"}
              onError={() => setImgError(true)}
            />
            <a
              className="inline-flex rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink/80 transition hover:bg-ink/[0.04]"
              href={downloadSrc}
              download="generated-image.png"
              target="_blank"
              rel="noopener noreferrer"
            >
              下载图片
            </a>
          </div>
        ) : null}
        {message.content ? (
          <div className="prose-chat text-[15px] leading-7 text-ink/90">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code(props) {
                  const { className, children } = props;
                  const content = String(children).replace(/\n$/, "");
                  // @ts-expect-error - inline is a custom prop from react-markdown
                  const inline = props.inline;

                  // 明确判断是否为内联代码
                  if (inline || !content.includes('\n')) {
                    return (
                      <code className={className}>
                        {children}
                      </code>
                    );
                  }

                  // 多行代码块
                  return <CodeBlock className={className}>{content}</CodeBlock>;
                },
                p(props) {
                  const { children } = props;
                  const node = props.node;
                  // 检查子元素中是否包含代码块，如果是则不使用 <p> 包裹
                  const hasCodeBlock = node?.children?.some(
                    (child) =>
                      child.type === 'element' &&
                      child.tagName === 'code' &&
                      child.properties?.className
                  );

                  if (hasCodeBlock) {
                    return <div className="my-2">{children}</div>;
                  }

                  return <p>{children}</p>;
                },
                table({ children }) {
                  return (
                    <div className="my-4 overflow-x-auto">
                      <table>{children}</table>
                    </div>
                  );
                },
                pre({ children }) {
                  return <>{children}</>;
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : null}
        {message.pending && !message.content ? (
          <span className="inline-flex items-center gap-2 text-muted">
            <span className="inline-block h-2 w-2 animate-blink rounded-full bg-accent/70" />
            正在思考...
          </span>
        ) : null}
        {!message.pending && message.content ? (
          <div className="mt-2 flex items-center gap-1">
            {onCopy ? (
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-ink/[0.04] hover:text-ink"
                title={copied ? "已复制" : "复制"}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>复制</span>
                  </>
                )}
              </button>
            ) : null}
            {onRegenerate ? (
              <button
                onClick={() => onRegenerate(message.id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-ink/[0.04] hover:text-ink"
                title="重新生成"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                <span>重新生成</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChatClient({ username }: { username: string }) {
  const [models, setModels] = useState<PublicModel[]>([]);
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [modelsError, setModelsError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectedModel = useMemo(() => models.find((model) => model.id === selectedModelId) || null, [models, selectedModelId]);
  const modelsByProvider = useMemo(() => groupedModels(models), [models]);

  const loadModels = useCallback(async () => {
    const response = await fetch("/api/models", { cache: "no-store" });

    if (response.status === 401) {
      window.location.href = "/login";
      throw new Error("登录状态已失效，请重新登录。");
    }

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const payload = await response.json();
    const nextModels = (payload.models || []) as PublicModel[];
    setModels(nextModels);
    setModelsError("");
    setSelectedModelId((currentModelId) => (nextModels.some((model) => model.id === currentModelId) ? currentModelId : nextModels[0]?.id || ""));
  }, []);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/conversations", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const payload = await response.json();
    setConversations(payload.conversations || []);
  }, []);

  useEffect(() => {
    Promise.all([loadModels(), loadConversations()]).catch((loadError) => {
      const message = loadError instanceof Error ? loadError.message : "初始化失败。";
      setError(message);
      setModelsError(message);
    });
  }, [loadModels, loadConversations]);

  useEffect(() => {
    scrollElementIntoView(bottomRef.current);
  }, [messages]);

  async function loadConversation(conversationId: string) {
    setError("");
    setStatus("正在加载会话...");

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const payload = await response.json();
      const conversation = payload.conversation as ConversationDto;
      setActiveConversationId(conversation.id);
      setMessages((conversation.messages || []) as LocalMessage[]);

      if (conversation.modelId) {
        setSelectedModelId(conversation.modelId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载会话失败。");
    } finally {
      setStatus("");
    }
  }

  function newConversation() {
    abortRef.current?.abort();
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setError("");
  }

  async function deleteConversation(conversationId: string) {
    const confirmed = await confirm({
      title: "删除会话",
      description: "该会话的所有消息将被永久删除，无法恢复。",
      confirmText: "删除",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    if (activeConversationId === conversationId) {
      newConversation();
    }

    await loadConversations();
  }

  function applyStreamEvent(streamEvent: StreamEvent, assistantMessageId: string) {
    if (streamEvent.eventName === "meta") {
      setActiveConversationId(typeof streamEvent.data.conversationId === "string" ? streamEvent.data.conversationId : null);
    }

    if (streamEvent.eventName === "delta") {
      const delta = typeof streamEvent.data.content === "string" ? streamEvent.data.content : "";
      setMessages((currentMessages) => currentMessages.map((message) => (message.id === assistantMessageId ? { ...message, content: `${message.content}${delta}` } : message)));
    }

    if (streamEvent.eventName === "done") {
      const messageId = typeof streamEvent.data.messageId === "string" ? streamEvent.data.messageId : assistantMessageId;
      const content = typeof streamEvent.data.content === "string" ? streamEvent.data.content : undefined;
      setMessages((currentMessages) => currentMessages.map((message) => (message.id === assistantMessageId ? { ...message, id: messageId, content: content || message.content, pending: false } : message)));
    }

    if (streamEvent.eventName === "error") {
      throw new Error(typeof streamEvent.data.message === "string" ? streamEvent.data.message : "模型调用失败。");
    }
  }

  async function sendChatMessage(prompt: string) {
    const userMessage = localMessage("user", prompt);
    const assistantMessage = localMessage("assistant", "");
    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((currentMessages) => [...currentMessages, userMessage, assistantMessage]);
    setInput("");
    setError("");
    setStatus("正在连接模型...");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          modelId: selectedModelId,
          content: prompt
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(await readError(response));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      setStatus("正在生成回复...");

      while (!done) {
        const result = await reader.read();
        done = result.done;
        buffer += decoder.decode(result.value ?? new Uint8Array(), { stream: !done });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const streamEvent = parseStreamEvent(block);

          if (streamEvent) {
            applyStreamEvent(streamEvent, assistantMessage.id);
          }
        }
      }

      setMessages((currentMessages) => currentMessages.map((message) => (message.id === assistantMessage.id ? { ...message, pending: false } : message)));
      await loadConversations();
    } catch (chatError) {
      const aborted = controller.signal.aborted;
      const errorMessage = aborted ? "已停止生成。" : chatError instanceof Error ? chatError.message : "发送失败。";
      setError(errorMessage);
      setMessages((currentMessages) => currentMessages.map((message) => (message.id === assistantMessage.id ? { ...message, content: message.content || errorMessage, pending: false } : message)));
    } finally {
      setStatus("");
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function handleEditMessage(messageId: string, newContent: string) {
    // 找到该消息的索引
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1) return;

    // 删除该消息及之后的所有消息
    setMessages((currentMessages) => currentMessages.slice(0, messageIndex));

    // 以新内容重新发送
    await sendChatMessage(newContent);
  }

  async function handleRegenerateMessage(messageId: string) {
    // 找到该 AI 消息的索引
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1 || messageIndex === 0) return;

    // 找到上一条用户消息
    const previousUserMessage = messages
      .slice(0, messageIndex)
      .reverse()
      .find((msg) => msg.role === "user");

    if (!previousUserMessage) return;

    // 删除当前 AI 消息及之后的所有消息
    setMessages((currentMessages) => currentMessages.slice(0, messageIndex));

    // 用上一条用户消息重新生成
    await sendChatMessage(previousUserMessage.content);
  }

  function handleCopyMessage(content: string) {
    navigator.clipboard.writeText(content).catch(() => {
      setError("复制失败，请手动选择复制。");
    });
  }

  async function sendImageMessage(prompt: string) {
    const userMessage = localMessage("user", prompt);
    const assistantMessage = localMessage("assistant", "正在生成图片...");
    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((currentMessages) => [...currentMessages, userMessage, assistantMessage]);
    setInput("");
    setError("");
    setStatus("正在生成图片...");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          modelId: selectedModelId,
          prompt
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const payload = await response.json();
      setActiveConversationId(payload.conversation?.id || null);
      setMessages((currentMessages) => [...currentMessages.filter((message) => message.id !== userMessage.id && message.id !== assistantMessage.id), ...(payload.messages || [])]);
      await loadConversations();
    } catch (imageError) {
      const errorMessage = controller.signal.aborted ? "已停止生成。" : imageError instanceof Error ? imageError.message : "图片生成失败。";
      setError(errorMessage);
      setMessages((currentMessages) => currentMessages.map((message) => (message.id === assistantMessage.id ? { ...message, content: errorMessage, pending: false } : message)));
    } finally {
      setStatus("");
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();

    if (!prompt || isStreaming) {
      return;
    }

    if (!selectedModel) {
      setError("请先在后台添加并启用模型。");
      return;
    }

    const isImageModel = selectedModel.type === "image" || selectedModel.capabilities.split(",").includes("image");

    if (isImageModel) {
      await sendImageMessage(prompt);
      return;
    }

    await sendChatMessage(prompt);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className={`grid h-screen overflow-hidden bg-canvas text-ink transition-[grid-template-columns] duration-300 ${sidebarCollapsed ? "lg:grid-cols-[4.5rem_minmax(0,1fr)]" : "lg:grid-cols-[17.5rem_minmax(0,1fr)]"}`}>
      {/* 移动端遮罩 */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex min-h-0 w-72 flex-col border-r border-line/70 bg-sidebar transition-transform duration-300 lg:static lg:z-auto lg:w-auto ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} lg:flex`}>
        <div className={`flex h-14 items-center px-3 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2 pl-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-display text-[17px] font-semibold tracking-tight text-ink">Light Chat</span>
            </div>
          ) : null}
          <button
            className="hidden h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink lg:flex"
            title={sidebarCollapsed ? "展开侧栏" : "折叠侧栏"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink lg:hidden"
            title="关闭侧边栏"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-3 pb-1 pt-1">
          <button
            className={`group flex w-full items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-sm font-medium text-ink shadow-sm transition-all hover:border-accent/40 hover:bg-accent/[0.05] active:scale-[0.99] ${sidebarCollapsed ? "justify-center px-0" : ""}`}
            onClick={newConversation}
            title="新建会话"
          >
            <Plus className="h-4 w-4 text-accent transition-transform group-hover:rotate-90" />
            {!sidebarCollapsed ? <span>新建会话</span> : null}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {conversations.length === 0 ? <p className="px-3 py-2 text-sm text-muted">暂无历史会话</p> : null}
            <div className="space-y-0.5">
              {conversations.map((conversation) => {
                const active = activeConversationId === conversation.id;

                return (
                  <div key={conversation.id} className={`group relative rounded-xl transition-colors ${active ? "bg-accent/10" : "hover:bg-ink/[0.04]"}`}>
                    <button className="block w-full px-3 py-2 pr-9 text-left" onClick={() => loadConversation(conversation.id)}>
                      <span className={`block truncate text-sm ${active ? "font-medium text-ink" : "text-ink/90"}`}>{conversation.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {formatDateShort(conversation.createdAt)} · {conversation.modelName || "未选择模型"}
                      </span>
                    </button>
                    <button
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-ink/[0.06] hover:text-red-500 group-hover:opacity-100"
                      title="删除会话"
                      onClick={() => deleteConversation(conversation.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-3">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-1">
              <Link className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink" href="/admin" title="后台">
                <Settings className="h-[18px] w-[18px]" />
              </Link>
              <ThemeToggle compact />
              <button className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink" onClick={logout} title="退出登录">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl px-2 py-1.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                {(username[0] || "U").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{username}</p>
                <p className="text-xs text-muted">管理员</p>
              </div>
              <Link className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink" href="/admin" title="后台">
                <Settings className="h-[17px] w-[17px]" />
              </Link>
              <ThemeToggle compact className="!h-8 !w-8 shrink-0" />
              <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.05] hover:text-red-500" onClick={logout} title="退出登录">
                <LogOut className="h-[17px] w-[17px]" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col bg-canvas">
        <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-center gap-3 px-3 py-2.5 sm:px-4">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              title="打开侧边栏"
            >
              <MessageSquare className="h-[18px] w-[18px]" />
            </button>
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <select
                className="w-full cursor-pointer appearance-none truncate rounded-xl border border-line bg-card py-2 pl-3.5 pr-9 text-sm font-medium text-ink outline-none transition hover:bg-ink/[0.02] focus:border-accent/60 focus:ring-4 focus:ring-accent/10 dark:bg-card"
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
              >
                {models.length === 0 ? <option value="">暂无可用模型</option> : null}
                {modelsByProvider.map((group) => (
                  <optgroup key={group.providerId} label={group.providerName}>
                    {group.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} · {model.type}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            <button
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium text-ink/80 transition hover:bg-ink/[0.04] lg:hidden"
              onClick={newConversation}
              title="新建会话"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">新会话</span>
            </button>
          </div>
        </header>

        {messages.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4">
            <div className="mx-auto w-full max-w-3xl -mt-16">
              {models.length === 0 ? (
                <div className="mb-6 rounded-2xl border border-dashed border-line bg-card/60 px-4 py-3 text-sm text-muted">
                  {modelsError ? (
                    <span>模型加载失败：{modelsError}。请确认手机端已登录，并且访问的是与电脑端相同的域名。</span>
                  ) : (
                    <span>
                      暂无可用模型。请先进入{" "}
                      <Link className="font-medium text-accent underline underline-offset-2" href="/admin">
                        后台
                      </Link>{" "}
                      添加服务商，并点击&ldquo;查询导入&rdquo;。
                    </span>
                  )}
                </div>
              ) : null}

              <div className="mb-8 animate-fade-in text-center">
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-sm">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="font-display text-[28px] font-semibold tracking-tight text-ink">你好，{username}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">今天想聊点什么？选择模型后开始对话，图片模型会直接返回可预览图片。</p>
              </div>

              {(status || error) && (
                <div className="mb-4 space-y-2">
                  {status ? (
                    <p className="flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
                      <span className="inline-block h-1.5 w-1.5 animate-blink rounded-full bg-accent" />
                      {status}
                    </p>
                  ) : null}
                  {error ? <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
                </div>
              )}

              <form
                className="flex items-center gap-2 rounded-3xl border border-line bg-card p-2 pl-4 shadow-soft transition-all focus-within:border-accent/50 focus-within:shadow-lift"
                onSubmit={submitMessage}
              >
                <textarea
                  className="max-h-44 min-h-[44px] flex-1 resize-none border-0 bg-transparent py-2.5 text-[15px] leading-7 text-ink outline-none placeholder:text-muted/70 focus:ring-0"
                  disabled={models.length === 0}
                  placeholder={selectedModel?.type === "image" ? "输入图片提示词..." : "输入消息，Enter 发送，Shift + Enter 换行..."}
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      const form = event.currentTarget.form;
                      form?.requestSubmit();
                    }
                  }}
                />
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    title="停止生成"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink/70 transition hover:bg-ink/[0.05] active:scale-95"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() || !selectedModelId || models.length === 0}
                    title="发送"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm transition-all hover:bg-accent/90 hover:shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    <Send className="h-[18px] w-[18px]" />
                  </button>
                )}
              </form>
              <p className="mt-3 text-center text-xs text-muted/80">内容由 AI 生成，请自行核实重要信息。</p>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-4">
              <div className="mx-auto w-full max-w-3xl">
                {models.length === 0 ? (
                  <div className="mb-4 rounded-2xl border border-dashed border-line bg-card/60 px-4 py-3 text-sm text-muted">
                    {modelsError ? (
                      <span>模型加载失败：{modelsError}。请确认手机端已登录，并且访问的是与电脑端相同的域名。</span>
                    ) : (
                      <span>
                        暂无可用模型。请先进入{" "}
                        <Link className="font-medium text-accent underline underline-offset-2" href="/admin">
                          后台
                        </Link>{" "}
                        添加服务商，并点击&ldquo;查询导入&rdquo;。
                      </span>
                    )}
                  </div>
                ) : null}

                <div className="space-y-6">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onEdit={message.role === "user" && !isStreaming ? handleEditMessage : undefined}
                      onRegenerate={message.role === "assistant" && !isStreaming ? handleRegenerateMessage : undefined}
                      onCopy={!isStreaming ? handleCopyMessage : undefined}
                    />
                  ))}
                </div>
                <div ref={bottomRef} className="h-4" />
              </div>
            </div>

            <footer className="bg-canvas px-3 pb-4 pt-1 sm:px-4">
              <div className="mx-auto w-full max-w-3xl">
                {(status || error) && (
                  <div className="mb-2 space-y-2">
                    {status ? (
                      <p className="flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
                        <span className="inline-block h-1.5 w-1.5 animate-blink rounded-full bg-accent" />
                        {status}
                      </p>
                    ) : null}
                    {error ? <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
                  </div>
                )}
                <form
                  className="flex items-center gap-2 rounded-3xl border border-line bg-card p-2 pl-4 shadow-soft transition-all focus-within:border-accent/50 focus-within:shadow-lift"
                  onSubmit={submitMessage}
                >
                  <textarea
                    className="max-h-44 min-h-[44px] flex-1 resize-none border-0 bg-transparent py-2.5 text-[15px] leading-7 text-ink outline-none placeholder:text-muted/70 focus:ring-0"
                    disabled={models.length === 0}
                    placeholder={selectedModel?.type === "image" ? "输入图片提示词..." : "输入消息，Enter 发送，Shift + Enter 换行..."}
                    rows={1}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        const form = event.currentTarget.form;
                        form?.requestSubmit();
                      }
                    }}
                  />
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      title="停止生成"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink/70 transition hover:bg-ink/[0.05] active:scale-95"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() || !selectedModelId || models.length === 0}
                      title="发送"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm transition-all hover:bg-accent/90 hover:shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                      <Send className="h-[18px] w-[18px]" />
                    </button>
                  )}
                </form>
                <p className="mt-2 text-center text-xs text-muted/80">内容由 AI 生成，请自行核实重要信息。</p>
              </div>
            </footer>
          </>
        )}
      </section>
      {confirmDialog}
    </main>
  );
}
