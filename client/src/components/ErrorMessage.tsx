import { AlertCircle } from "lucide-react";

export function ErrorMessage({ title = "Something went wrong", message }: { title?: string; message: string }) {
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-rose-800">{message}</p>
      </div>
    </div>
  );
}
