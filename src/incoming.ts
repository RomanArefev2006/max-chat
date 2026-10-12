import type { Dispatch, SetStateAction } from "react";
import { formatPhone } from "./phone.ts";
import type { Chat, ChatMessage, IncomingNotification } from "./types.ts";

const MESSAGE_LIMIT = 300;

function toMillis(timestamp?: number): number {
  if (!timestamp) return Date.now();
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

function textOf(notification: IncomingNotification): string | null {
  const messageData = notification.body?.messageData;
  if (!messageData || notification.body?.typeWebhook !== "incomingMessageReceived") return null;

  if (messageData.typeMessage === "textMessage") {
    return messageData.textMessageData?.textMessage?.trim() || null;
  }

  if (messageData.typeMessage === "extendedTextMessage") {
    return messageData.extendedTextMessageData?.text?.trim() || null;
  }

  return null;
}

export function applyIncoming(
  notification: IncomingNotification,
  setChats: Dispatch<SetStateAction<Chat[]>>,
  getActiveChatId: () => string | null,
): void {
  const text = textOf(notification);
  const sender = notification.body?.senderData;
  const chatId = sender?.chatId;
  if (!text || !chatId) return;

  const message: ChatMessage = {
    id: notification.body?.idMessage || `in-${notification.receiptId}`,
    text,
    direction: "in",
    timestamp: toMillis(notification.body?.timestamp),
    status: "sent",
  };
  const phoneNumber = sender.senderPhoneNumber ? String(sender.senderPhoneNumber) : "";
  const phone = phoneNumber === "0" ? "" : phoneNumber;
  const title = sender.chatName?.trim() || sender.senderName?.trim() || (phone ? formatPhone(phone) : chatId);
  const active = getActiveChatId() === chatId;

  setChats((current) => {
    const index = current.findIndex((chat) => chat.chatId === chatId);

    if (index === -1) {
      const chat: Chat = {
        chatId,
        phone,
        title,
        messages: [message],
        unread: active ? 0 : 1,
        updatedAt: message.timestamp,
      };
      return [chat, ...current];
    }

    const chat = current[index];
    if (chat.messages.some((item) => item.id === message.id)) return current;

    const updated: Chat = {
      ...chat,
      phone: chat.phone || phone,
      title: sender.chatName?.trim() || sender.senderName?.trim() || chat.title,
      messages: [...chat.messages, message].slice(-MESSAGE_LIMIT),
      unread: active ? 0 : chat.unread + 1,
      updatedAt: message.timestamp,
    };
    const next = [...current];
    next.splice(index, 1);
    return [updated, ...next];
  });
}
