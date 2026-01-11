import { clsx, type ClassValue } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errorReporting(error: unknown) {
  console.error(error);

  return toast.error(String(error), {
    dismissible: true,
    id: `error-${String(error)}`,
    duration: 5000,
    closeButton: true,
  });
}

export function formatGibToReadable(gib?: number): string {
  if (!gib || gib === 0) return "0 B";

  const bytes = gib * 1024 ** 3;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

export function intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  return new Set([...setA].filter((x) => setB.has(x)));
}
