import { useEffect, useId, useState, type FormEvent } from "react";
import { normalizePhone } from "../phone.ts";

type NewChatDialogProps = {
  onClose: () => void;
  onCreate: (phone: string) => Promise<void>;
};

export function NewChatDialog({ onClose, onCreate }: NewChatDialogProps) {
  const inputId = useId();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!normalizePhone(phone)) {
      setError("Нужен номер России (код 7) или Беларуси (код 375)");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate(phone);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать чат");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="card dialog-card" onSubmit={(event) => void handleSubmit(event)}>
        <h2>Новый чат</h2>
        <p className="lede">Номер получателя в MAX. Можно ввести с +7, с 8 или без кода страны.</p>
        <label htmlFor={inputId}>Телефон</label>
        <input
          id={inputId}
          autoFocus
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 999 123 45 67"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? "Проверяем номер…" : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
}
