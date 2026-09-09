"use client";

import type { Contact, SortDirection, SortKey } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "company", label: "Company" },
  { key: "priority", label: "Priority" },
  { key: "met_at", label: "Met at" },
  { key: "created_at", label: "Added" },
];

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return null;
  return <span className="ml-1 text-zinc-400">{direction === "asc" ? "↑" : "↓"}</span>;
}

export function ContactList({
  contacts,
  sortKey,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left font-medium text-zinc-600">
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className="flex items-center hover:text-zinc-900"
                  >
                    {col.label}
                    <SortIndicator active={sortKey === col.key} direction={sortDirection} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium text-zinc-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {contacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">{contact.name}</td>
                <td className="px-4 py-3 text-zinc-600">{contact.company || "—"}</td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={contact.priority} />
                </td>
                <td className="px-4 py-3 text-zinc-600">{contact.met_at || "—"}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(contact.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => onEdit(contact)}
                      className="font-medium text-zinc-700 hover:text-zinc-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(contact)}
                      className="font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {contacts.map((contact) => (
          <div key={contact.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-zinc-900">{contact.name}</p>
                {contact.company && <p className="text-sm text-zinc-600">{contact.company}</p>}
                {contact.role && <p className="text-sm text-zinc-500">{contact.role}</p>}
              </div>
              <PriorityBadge priority={contact.priority} />
            </div>
            {contact.met_at && (
              <p className="mt-2 text-sm text-zinc-500">Met at: {contact.met_at}</p>
            )}
            {contact.notes && <p className="mt-2 text-sm text-zinc-700">{contact.notes}</p>}
            <div className="mt-3 flex justify-end gap-4 border-t border-zinc-100 pt-3">
              <button
                type="button"
                onClick={() => onEdit(contact)}
                className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(contact)}
                className="text-sm font-medium text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
