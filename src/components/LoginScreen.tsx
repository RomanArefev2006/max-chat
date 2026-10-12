import { useId, useState, type FormEvent } from "react";
import type { Credentials } from "../types.ts";

type LoginScreenProps = {
  onSubmit: (credentials: Credentials) => Promise<void>;
};

function normalizeApiUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function LoginScreen({ onSubmit }: LoginScreenProps) {
  const idInstanceId = useId();
  const tokenId = useId();
  const apiUrlId = useId();
  const [idInstance, setIdInstance] = useState("");
  const [apiTokenInstance, setApiTokenInstance] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextId = idInstance.trim();
    const nextToken = apiTokenInstance.trim();
    const nextUrl = normalizeApiUrl(apiUrl);

    if (!/^\d+$/.test(nextId)) {
      setError("idInstance должен состоять только из цифр");
      return;
    }
    if (nextToken.length < 8) {
      setError("Вставьте apiTokenInstance из личного кабинета");
      return;
    }
    try {
      const url = new URL(nextUrl);
      if (url.protocol !== "https:") throw new Error("protocol");
    } catch {
      setError("apiUrl должен быть адресом https, например https://1101.api.green-api.com");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        idInstance: nextId,
        apiTokenInstance: nextToken,
        apiUrl: nextUrl,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="card" onSubmit={(event) => void handleSubmit(event)}>
        <p className="brand brand-large">MAX</p>
        <h1>Вход в чат</h1>
        <p className="lede">
          Укажите данные инстанса GREEN-API. Они есть на карточке инстанса в личном кабинете.
        </p>

        <label htmlFor={idInstanceId}>idInstance</label>
        <input
          id={idInstanceId}
          name="idInstance"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1101000001"
          value={idInstance}
          onChange={(event) => setIdInstance(event.target.value)}
        />

        <label htmlFor={tokenId}>apiTokenInstance</label>
        <div className="input-row">
          <input
            id={tokenId}
            name="apiTokenInstance"
            type={showToken ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder="Ключ доступа"
            value={apiTokenInstance}
            onChange={(event) => setApiTokenInstance(event.target.value)}
          />
          <button type="button" className="input-action" onClick={() => setShowToken((value) => !value)}>
            {showToken ? "Скрыть" : "Показать"}
          </button>
        </div>

        <label htmlFor={apiUrlId}>apiUrl</label>
        <input
          id={apiUrlId}
          name="apiUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://1101.api.green-api.com"
          value={apiUrl}
          onChange={(event) => setApiUrl(event.target.value)}
        />
        <p className="field-hint">Хост apiUrl с той же карточки инстанса, без слэша в конце.</p>

        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Проверяем инстанс…" : "Войти"}
        </button>

        <details className="notes">
          <summary>Что включить в кабинете</summary>
          <ul>
            <li>Инстанс MAX авторизован по QR-коду</li>
            <li>Поле webhook URL пустое</li>
            <li>Включены уведомления о входящих сообщениях</li>
          </ul>
        </details>
      </form>
    </main>
  );
}
