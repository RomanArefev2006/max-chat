import type { Credentials, IncomingNotification } from "./types.ts";

const MAX_MESSAGE_LENGTH = 4000;

export class GreenApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GreenApiError";
    this.status = status;
  }
}

function endpoint(credentials: Credentials, method: string): string {
  const base = credentials.apiUrl.replace(/\/+$/, "");
  const idInstance = encodeURIComponent(credentials.idInstance);
  const token = encodeURIComponent(credentials.apiTokenInstance);
  return `${base}/waInstance${idInstance}/${method}/${token}`;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function errorText(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  if (!text) return `Ошибка ${response.status}`;

  try {
    const data = JSON.parse(text) as {
      message?: string;
      error?: string;
      description?: string;
    };
    return data.message || data.error || data.description || text;
  } catch {
    return text;
  }
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new GreenApiError(
      0,
      "Нет ответа от GREEN-API. Проверьте apiUrl: браузер должен открывать именно хост с карточки инстанса.",
    );
  }

  if (!response.ok) {
    throw new GreenApiError(response.status, await errorText(response));
  }

  return response;
}

export async function getStateInstance(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<string> {
  const response = await request(endpoint(credentials, "getStateInstance"), {
    method: "GET",
    signal,
  });
  const data = (await response.json()) as { stateInstance?: string };
  if (!data.stateInstance) {
    throw new GreenApiError(response.status, "Не удалось прочитать состояние инстанса");
  }
  return data.stateInstance;
}

export async function checkAccount(
  credentials: Credentials,
  phone: string,
): Promise<{ exist: boolean; chatId: string }> {
  const response = await request(endpoint(credentials, "checkAccount"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: Number(phone) }),
  });
  const data = (await response.json()) as { exist?: boolean; chatId?: string };
  return {
    exist: Boolean(data.exist && data.chatId),
    chatId: data.chatId ?? "",
  };
}

export async function sendMessage(
  credentials: Credentials,
  chatId: string,
  message: string,
): Promise<string> {
  const text = message.trim();
  if (!text) throw new GreenApiError(0, "Введите текст сообщения");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new GreenApiError(0, "Текст сообщения должен быть не длиннее 4000 символов");
  }

  const response = await request(endpoint(credentials, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message: text }),
  });
  const data = (await response.json()) as { idMessage?: string };
  if (!data.idMessage) {
    throw new GreenApiError(response.status, "GREEN-API не вернул id сообщения");
  }
  return data.idMessage;
}

export async function receiveNotification(
  credentials: Credentials,
  receiveTimeout: number,
  signal: AbortSignal,
): Promise<IncomingNotification | null> {
  const url = `${endpoint(credentials, "receiveNotification")}?receiveTimeout=${receiveTimeout}`;
  const response = await request(url, { method: "GET", signal });
  const text = (await response.text()).trim();
  if (!text || text === "null") return null;

  try {
    const data = JSON.parse(text) as IncomingNotification;
    if (typeof data.receiptId !== "number") {
      throw new GreenApiError(response.status, "В уведомлении нет receiptId");
    }
    return data;
  } catch (error) {
    if (error instanceof GreenApiError) throw error;
    throw new GreenApiError(response.status, "Некорректный ответ ReceiveNotification");
  }
}

export async function deleteNotification(
  credentials: Credentials,
  receiptId: number,
  signal: AbortSignal,
): Promise<void> {
  await request(`${endpoint(credentials, "deleteNotification")}/${receiptId}`, {
    method: "DELETE",
    signal,
  });
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function isAbortError(error: unknown): boolean {
  return isAbort(error);
}
