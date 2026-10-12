export type Credentials = {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
};

export type MessageStatus = "sending" | "sent" | "error";

export type ChatMessage = {
  id: string;
  text: string;
  direction: "in" | "out";
  timestamp: number;
  status: MessageStatus;
};

export type Chat = {
  chatId: string;
  phone: string;
  title: string;
  messages: ChatMessage[];
  unread: number;
  updatedAt: number;
};

export type PollStatus = "connecting" | "online" | "error";

export type IncomingNotification = {
  receiptId: number;
  body?: {
    typeWebhook?: string;
    timestamp?: number;
    idMessage?: string;
    senderData?: {
      chatId?: string;
      chatName?: string;
      senderName?: string;
      senderPhoneNumber?: number;
    };
    messageData?: {
      typeMessage?: string;
      textMessageData?: {
        textMessage?: string;
      };
      extendedTextMessageData?: {
        text?: string;
      };
    };
  };
};
