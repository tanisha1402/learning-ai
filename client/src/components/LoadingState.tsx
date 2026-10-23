import { Loader2 } from "lucide-react";

export function LoadingState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" aria-hidden="true" />
        <div>
          <p className="font-medium">{message}</p>
          {detail ? <p className="text-slate-500">{detail}</p> : null}
        </div>
      </div>
      <div className="space-y-2.5" aria-hidden="true">
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
