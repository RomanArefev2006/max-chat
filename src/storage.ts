import type { Chat, ChatMessage, Credentials } from "./types.ts";

const CREDENTIALS_KEY = "max-chat.credentials";

function chatsKey(idInstance: string): string {
  return `max-chat.chats.${idInstance}`;
}

export function loadCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Credentials>;
    if (!data.apiUrl || !data.idInstance || !data.apiTokenInstance) return null;
    return {
      apiUrl: data.apiUrl,
      idInstance: data.idInstance,
      apiTokenInstance: data.apiTokenInstance,
    };
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: Credentials): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
}

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    typeof message.text === "string" &&
    (message.direction === "in" || message.direction === "out") &&
    (message.status === "sending" || message.status === "sent" || message.status === "error")
  );
}

export function loadChats(idInstance: string): Chat[] {
  try {
    const raw = localStorage.getItem(chatsKey(idInstance));
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];

    return data.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const chat = item as Partial<Chat>;
      if (typeof chat.chatId !== "string" || !Array.isArray(chat.messages)) return [];

      return [
        {
          chatId: chat.chatId,
          phone: typeof chat.phone === "string" ? chat.phone : "",
          title: typeof chat.title === "string" && chat.title ? chat.title : chat.chatId,
          unread: typeof chat.unread === "number" ? chat.unread : 0,
          updatedAt: typeof chat.updatedAt === "number" ? chat.updatedAt : Date.now(),
          messages: chat.messages.filter(isMessage).map((message) => ({
            ...message,
            timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
          })),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function saveChats(idInstance: string, chats: Chat[]): void {
  localStorage.setItem(chatsKey(idInstance), JSON.stringify(chats));
}
