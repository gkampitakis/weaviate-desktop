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
