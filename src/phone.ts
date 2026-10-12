export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    digits = `7${digits}`;
  }

  const russian = digits.startsWith("7") && digits.length === 11;
  const belarus = digits.startsWith("375") && digits.length === 12;

  return russian || belarus ? digits : null;
}

export function formatPhone(digits: string): string {
  if (digits.startsWith("7") && digits.length === 11) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }

  if (digits.startsWith("375") && digits.length === 12) {
    return `+375 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }

  return digits ? `+${digits}` : "";
}
