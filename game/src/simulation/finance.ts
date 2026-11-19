export function safe(value: number): number {
  if (!Number.isSafeInteger(value))
    throw new Error("Превышен допустимый диапазон расчётов.");
  return value;
}
