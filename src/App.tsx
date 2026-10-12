import { useEffect, useRef, useState } from "react";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { Messenger } from "./components/Messenger.tsx";
import {
  checkAccount,
  deleteNotification,
  getStateInstance,
  GreenApiError,
  isAbortError,
  receiveNotification,
  sendMessage,
  sleep,
} from "./greenApi.ts";
import { applyIncoming } from "./incoming.ts";
import { formatPhone, normalizePhone } from "./phone.ts";
import { clearCredentials, loadChats, loadCredentials, saveChats, saveCredentials } from "./storage.ts";
import type { Chat, ChatMessage, Credentials, PollStatus } from "./types.ts";

const MESSAGE_LIMIT = 300;
let pollGeneration = 0;

function patchMessage(
  chats: Chat[],
  chatId: string,
  messageId: string,
  patch: Partial<ChatMessage>,
): Chat[] {
  return chats.map((chat) => {
    if (chat.chatId !== chatId) return chat;
    return {
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message,
      ),
    };
  });
}

export default function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(() => loadCredentials());
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = loadCredentials();
    return saved ? loadChats(saved.idInstance) : [];
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [instanceState, setInstanceState] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<PollStatus>("connecting");
  const [pollError, setPollError] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    if (!credentials) return;
    saveChats(credentials.idInstance, chats);
  }, [credentials, chats]);

  useEffect(() => {
    if (!credentials) return;
    const controller = new AbortController();
    getStateInstance(credentials, controller.signal)
      .then((state) => {
        if (!controller.signal.aborted) setInstanceState(state);
      })
      .catch(() => {
        if (!controller.signal.aborted) setInstanceState(null);
      });
    return () => controller.abort();
  }, [credentials]);

  useEffect(() => {
    if (!credentials) return;

    const generation = ++pollGeneration;
    const controller = new AbortController();
    const currentCredentials = credentials;
    const active = () => generation === pollGeneration && !controller.signal.aborted;

    const run = async () => {
      setPollStatus("connecting");
      setPollError(null);
      let pendingReceipt: number | null = null;

      while (active()) {
        try {
          if (pendingReceipt !== null) {
            await deleteNotification(currentCredentials, pendingReceipt, controller.signal);
            pendingReceipt = null;
            continue;
          }

          const notification = await receiveNotification(currentCredentials, 20, controller.signal);
          if (!active()) return;
          setPollStatus("online");
          setPollError(null);
          if (!notification) continue;

          applyIncoming(notification, setChats, () => activeChatIdRef.current);
          pendingReceipt = notification.receiptId;
        } catch (error) {
          if (!active() || isAbortError(error)) return;
          setPollStatus("error");
          setPollError(error instanceof Error ? error.message : "Ошибка получения сообщений");
          try {
            await sleep(2500, controller.signal);
          } catch {
            return;
          }
        }
      }
    };

    void run();

    return () => {
      controller.abort();
      if (pollGeneration === generation) pollGeneration += 1;
    };
  }, [credentials]);

  async function handleLogin(next: Credentials): Promise<void> {
    const state = await getStateInstance(next);
    saveCredentials(next);
    setChats(loadChats(next.idInstance));
    setActiveChatId(null);
    setInstanceState(state);
    setPollStatus("connecting");
    setPollError(null);
    setCredentials(next);
  }

  function handleLogout(): void {
    clearCredentials();
    setCredentials(null);
    setChats([]);
    setActiveChatId(null);
    setInstanceState(null);
    setPollError(null);
  }

  function handleOpenChat(chatId: string): void {
    activeChatIdRef.current = chatId;
    setActiveChatId(chatId);
    setChats((current) =>
      current.map((chat) => (chat.chatId === chatId ? { ...chat, unread: 0 } : chat)),
    );
  }

  function handleCloseChat(): void {
    activeChatIdRef.current = null;
    setActiveChatId(null);
  }

  async function handleCreateChat(rawPhone: string): Promise<void> {
    if (!credentials) return;
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      throw new GreenApiError(0, "Нужен номер России (код 7) или Беларуси (код 375)");
    }

    const account = await checkAccount(credentials, phone);
    if (!account.exist) {
      throw new GreenApiError(0, "На этом номере нет аккаунта MAX");
    }

    setChats((current) => {
      if (current.some((chat) => chat.chatId === account.chatId)) return current;
      const chat: Chat = {
        chatId: account.chatId,
        phone,
        title: formatPhone(phone),
        messages: [],
        unread: 0,
        updatedAt: Date.now(),
      };
      return [chat, ...current];
    });
    handleOpenChat(account.chatId);
  }

  async function deliver(
    chatId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    if (!credentials) return;
    try {
      const idMessage = await sendMessage(credentials, chatId, text);
      setChats((current) => patchMessage(current, chatId, messageId, { id: idMessage, status: "sent" }));
    } catch (error) {
      setChats((current) => patchMessage(current, chatId, messageId, { status: "error" }));
      throw error;
    }
  }

  async function handleSend(chatId: string, text: string): Promise<void> {
    const localId = `local-${crypto.randomUUID()}`;
    const message: ChatMessage = {
      id: localId,
      text: text.trim(),
      direction: "out",
      timestamp: Date.now(),
      status: "sending",
    };

    setChats((current) => {
      const next = current.map((chat) => {
        if (chat.chatId !== chatId) return chat;
        return {
          ...chat,
          messages: [...chat.messages, message].slice(-MESSAGE_LIMIT),
          updatedAt: message.timestamp,
        };
      });
      const index = next.findIndex((chat) => chat.chatId === chatId);
      if (index <= 0) return next;
      const [chat] = next.splice(index, 1);
      return [chat, ...next];
    });

    await deliver(chatId, localId, message.text);
  }

  async function handleRetry(chatId: string, messageId: string): Promise<void> {
    const message = chats.find((chat) => chat.chatId === chatId)?.messages.find((item) => item.id === messageId);
    if (!message || message.status === "sending") return;
    setChats((current) => patchMessage(current, chatId, messageId, { status: "sending" }));
    await deliver(chatId, messageId, message.text);
  }

  if (!credentials) {
    return <LoginScreen onSubmit={handleLogin} />;
  }

  return (
    <Messenger
      idInstance={credentials.idInstance}
      instanceState={instanceState}
      pollStatus={pollStatus}
      pollError={pollError}
      chats={chats}
      activeChatId={activeChatId}
      onOpenChat={handleOpenChat}
      onCloseChat={handleCloseChat}
      onLogout={handleLogout}
      onCreateChat={handleCreateChat}
      onSend={handleSend}
      onRetry={handleRetry}
    />
  );
}
