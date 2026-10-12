import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { NewChatDialog } from "./NewChatDialog.tsx";
import { formatPhone } from "../phone.ts";
import type { Chat, ChatMessage, PollStatus } from "../types.ts";

type MessengerProps = {
  idInstance: string;
  instanceState: string | null;
  pollStatus: PollStatus;
  pollError: string | null;
  chats: Chat[];
  activeChatId: string | null;
  onOpenChat: (chatId: string) => void;
  onCloseChat: () => void;
  onLogout: () => void;
  onCreateChat: (phone: string) => Promise<void>;
  onSend: (chatId: string, text: string) => Promise<void>;
  onRetry: (chatId: string, messageId: string) => Promise<void>;
};

const STATE_LABELS: Record<string, string> = {
  authorized: "авторизован",
  notAuthorized: "не авторизован",
  blocked: "заблокирован",
  sleepMode: "в спящем режиме",
  starting: "запускается",
  yellowCard: "ограничен",
  pendingPassword: "ждёт пароль 2FA",
};

const POLL_LABELS: Record<PollStatus, string> = {
  connecting: "Подключение",
  online: "На связи",
  error: "Нет связи",
};

function formatListTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

function formatMessageTime(timestamp: number): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function avatarHue(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash + char.charCodeAt(0) * 17) % 360;
  return hash;
}

function preview(chat: Chat): string {
  const last = chat.messages[chat.messages.length - 1];
  if (!last) return "Нет сообщений";
  return last.direction === "out" ? `Вы: ${last.text}` : last.text;
}

export function Messenger({
  idInstance,
  instanceState,
  pollStatus,
  pollError,
  chats,
  activeChatId,
  onOpenChat,
  onCloseChat,
  onLogout,
  onCreateChat,
  onSend,
  onRetry,
}: MessengerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const activeChat = chats.find((chat) => chat.chatId === activeChatId) ?? null;

  return (
    <div className={activeChat ? "shell chat-open" : "shell"}>
      <aside className="sidebar">
        <header className="sidebar-header">
          <p className="brand">MAX</p>
          <button type="button" className="new-chat" onClick={() => setDialogOpen(true)}>
            Новый чат
          </button>
        </header>

        {instanceState && instanceState !== "authorized" ? (
          <p className="banner" role="status">
            Инстанс {STATE_LABELS[instanceState] ?? instanceState}. Авторизуйте его QR-кодом в кабинете GREEN-API.
          </p>
        ) : null}
        {pollError ? (
          <p className="banner" role="alert">
            {pollError}
          </p>
        ) : null}

        <div className="chat-list">
          {chats.length === 0 ? (
            <p className="empty-list">Чатов пока нет. Создайте диалог по номеру телефона.</p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.chatId}
                type="button"
                className={chat.chatId === activeChatId ? "chat-row active" : "chat-row"}
                onClick={() => onOpenChat(chat.chatId)}
              >
                <Avatar title={chat.title} seed={chat.chatId} />
                <span className="chat-row-body">
                  <span className="chat-row-top">
                    <span className="chat-title">{chat.title}</span>
                    {chat.messages.length > 0 ? (
                      <time dateTime={new Date(chat.updatedAt).toISOString()}>
                        {formatListTime(chat.updatedAt)}
                      </time>
                    ) : null}
                  </span>
                  <span className="chat-row-bottom">
                    <span className="preview">{preview(chat)}</span>
                    {chat.unread > 0 ? <span className="unread">{chat.unread}</span> : null}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <footer className="sidebar-footer">
          <p className="status">
            <span className={`dot ${pollStatus}`} />
            {POLL_LABELS[pollStatus]}
          </p>
          <p className="instance-id">idInstance {idInstance}</p>
          <button type="button" className="text-button" onClick={onLogout}>
            Выйти
          </button>
        </footer>
      </aside>

      <section className="conversation">
        {activeChat ? (
          <ChatView
            key={activeChat.chatId}
            chat={activeChat}
            onBack={onCloseChat}
            onSend={onSend}
            onRetry={onRetry}
          />
        ) : (
          <div className="empty-chat">
            <p className="brand brand-large">MAX</p>
            <h2>Выберите чат</h2>
            <p>Напишите сообщение — ответ из мессенджера появится в этом окне.</p>
          </div>
        )}
      </section>

      {dialogOpen ? <NewChatDialog onClose={() => setDialogOpen(false)} onCreate={onCreateChat} /> : null}
    </div>
  );
}

function Avatar({ title, seed }: { title: string; seed: string }) {
  const letter = (title.match(/[A-Za-zА-Яа-яЁё0-9]/)?.[0] ?? "?").toUpperCase();
  return (
    <span className="avatar" style={{ backgroundColor: `hsl(${avatarHue(seed)} 62% 48%)` }} aria-hidden="true">
      {letter}
    </span>
  );
}

function ChatView({
  chat,
  onBack,
  onSend,
  onRetry,
}: {
  chat: Chat;
  onBack: () => void;
  onSend: (chatId: string, text: string) => Promise<void>;
  onRetry: (chatId: string, messageId: string) => Promise<void>;
}) {
  const inputId = useId();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneLabel = formatPhone(chat.phone);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [chat.chatId, chat.messages.length]);

  async function submit(): Promise<void> {
    const value = text.trim();
    if (!value || sending) return;
    if (value.length > 4000) {
      setError("Текст сообщения должен быть не длиннее 4000 символов");
      return;
    }

    setSending(true);
    setError(null);
    setText("");
    try {
      await onSend(chat.chatId, value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <>
      <header className="chat-header">
        <button type="button" className="back-button" onClick={onBack}>
          Назад
        </button>
        <Avatar title={chat.title} seed={chat.chatId} />
        <div>
          <h2>{chat.title}</h2>
          {phoneLabel ? <p>{phoneLabel}</p> : null}
        </div>
      </header>

      <div className="messages">
        {chat.messages.length === 0 ? (
          <p className="empty-thread">Напишите первое сообщение</p>
        ) : (
          chat.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={() => void onRetry(chat.chatId, message.id)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Сообщение
        </label>
        <textarea
          id={inputId}
          rows={1}
          placeholder="Сообщение"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="send" disabled={sending || text.trim().length === 0} aria-label="Отправить">
          <SendIcon />
        </button>
      </form>
      {error ? (
        <p className="composer-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  return (
    <div className={`bubble ${message.direction} ${message.status}`}>
      <p>{message.text}</p>
      <time dateTime={new Date(message.timestamp).toISOString()}>
        {message.status === "sending" ? "…" : formatMessageTime(message.timestamp)}
      </time>
      {message.status === "error" ? (
        <button type="button" className="retry" onClick={onRetry}>
          Не отправлено. Повторить
        </button>
      ) : null}
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h11M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
