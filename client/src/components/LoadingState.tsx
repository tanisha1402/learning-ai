import { Loader2 } from "lucide-react";

export function LoadingState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-ink">
        <Loader2 className="h-5 w-5 animate-spin text-violet" aria-hidden="true" />
        <div>
          <p className="font-semibold">{message}</p>
          {detail ? <p className="text-muted">{detail}</p> : null}
        </div>
      </div>
      <div className="space-y-2.5" aria-hidden="true">
        <div className="h-3 w-full animate-pulse rounded-full bg-lilac" />
        <div className="h-3 w-11/12 animate-pulse rounded-full bg-lilac" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-lilac" />
      </div>
    </div>
  );
}
