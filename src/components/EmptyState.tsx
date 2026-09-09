export function EmptyState({
  hasFilters,
  onAdd,
}: {
  hasFilters: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <p className="text-base font-medium text-zinc-900">
        {hasFilters ? "No contacts match your search" : "No contacts yet"}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        {hasFilters
          ? "Try clearing your search or priority filter."
          : "Add the first person you want to stay in touch with."}
      </p>
      {!hasFilters && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Add your first contact
        </button>
      )}
    </div>
  );
}
