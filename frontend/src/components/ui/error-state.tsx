import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const ErrorState = ({ message, onRetry, isRetrying = false }: Props) => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <svg
        className="h-10 w-10 text-red-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <line
          x1="12"
          y1="8"
          x2="12"
          y2="13"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
      <p className="text-lg font-medium text-red-600">{message}</p>
      <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "Retrying..." : "Retry"}
      </Button>
    </div>
  );
};

export default ErrorState;
