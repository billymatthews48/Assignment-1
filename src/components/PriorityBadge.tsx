import type { Priority } from "@/lib/types";

const styles: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 ring-red-600/20",
  medium: "bg-amber-100 text-amber-700 ring-amber-600/20",
  low: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${styles[priority]}`}
    >
      {priority}
    </span>
  );
}
