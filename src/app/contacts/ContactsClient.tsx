"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticate } from "@neondatabase/auth-ui";
import { neon, isNeonConfigured } from "@/lib/neon";
import type { Contact, ContactInput, Priority, SortDirection, SortKey } from "@/lib/types";
import { ContactForm } from "@/components/ContactForm";
import { ContactList } from "@/components/ContactList";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";

type ModalState = { mode: "create" } | { mode: "edit"; contact: Contact } | null;

function friendlyError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return "Something went wrong talking to the database. Please try again.";
}

export function ContactsClient() {
  const { user, isPending: authPending } = useAuthenticate();

  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await neon.from("contacts").select("*");
        if (cancelled) return;
        if (error) {
          setLoadError(friendlyError(error));
          return;
        }
        setLoadError(null);
        setContacts((data ?? []) as Contact[]);
      } catch (err) {
        if (!cancelled) setLoadError(friendlyError(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const visibleContacts = useMemo(() => {
    if (!contacts) return [];
    const term = search.trim().toLowerCase();

    const filtered = contacts.filter((c) => {
      const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
      if (!matchesPriority) return false;
      if (!term) return true;
      return [c.name, c.company, c.role, c.notes]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term));
    });

    const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "company":
          comparison = (a.company ?? "").localeCompare(b.company ?? "");
          break;
        case "priority":
          comparison = priorityRank[a.priority] - priorityRank[b.priority];
          break;
        case "met_at":
          comparison = (a.met_at ?? "").localeCompare(b.met_at ?? "");
          break;
        case "created_at":
          comparison = a.created_at.localeCompare(b.created_at);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [contacts, search, priorityFilter, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  async function handleCreate(input: ContactInput) {
    if (!user) return;
    // user_id is intentionally omitted: the database default (auth.user_id())
    // sets it, so the client is never even given the ability to set it.
    const { data, error } = await neon
      .from("contacts")
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(friendlyError(error));

    setContacts((prev) => [data as Contact, ...(prev ?? [])]);
    setModal(null);
    setSuccessMessage("Contact added.");
  }

  async function handleUpdate(id: string, input: ContactInput) {
    const { data, error } = await neon
      .from("contacts")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(friendlyError(error));

    setContacts((prev) => (prev ?? []).map((c) => (c.id === id ? (data as Contact) : c)));
    setModal(null);
    setSuccessMessage("Contact updated.");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    const { error } = await neon.from("contacts").delete().eq("id", deleteTarget.id);

    if (error) {
      setActionError(friendlyError(error));
      return;
    }

    setContacts((prev) => (prev ?? []).filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    setSuccessMessage("Contact deleted.");
  }

  if (!isNeonConfigured) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <ErrorBanner message="Neon Auth / Data API is not configured yet. Set NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_NEON_DATA_API_URL in .env.local and restart the dev server." />
      </div>
    );
  }

  if (authPending) {
    return <LoadingState label="Checking your session…" />;
  }

  if (!user) {
    // useAuthenticate() is already redirecting to /auth/sign-in.
    return <LoadingState label="Redirecting to sign in…" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">My contacts</h1>
          <p className="text-sm text-zinc-500">
            Private to your account — protected by database-level row security.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          + Add contact
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, role, or notes"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 sm:max-w-sm"
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | "all")}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm capitalize focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 sm:w-40"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {successMessage && (
          <div
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {successMessage}
          </div>
        )}
        {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}
        {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}
      </div>

      <div className="mt-4">
        {contacts === null && !loadError ? (
          <LoadingState label="Loading your contacts…" />
        ) : visibleContacts.length === 0 ? (
          <EmptyState
            hasFilters={search.trim() !== "" || priorityFilter !== "all"}
            onAdd={() => setModal({ mode: "create" })}
          />
        ) : (
          <ContactList
            contacts={visibleContacts}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onEdit={(contact) => setModal({ mode: "edit", contact })}
            onDelete={(contact) => setDeleteTarget(contact)}
          />
        )}
      </div>

      {modal && (
        <Modal
          title={modal.mode === "create" ? "Add contact" : "Edit contact"}
          onClose={() => setModal(null)}
        >
          <ContactForm
            initial={modal.mode === "edit" ? modal.contact : undefined}
            submitLabel={modal.mode === "create" ? "Add contact" : "Save changes"}
            onCancel={() => setModal(null)}
            onSubmit={(input) =>
              modal.mode === "create" ? handleCreate(input) : handleUpdate(modal.contact.id, input)
            }
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete contact" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-zinc-700">
            Delete <span className="font-medium">{deleteTarget.name}</span>? This can&apos;t be
            undone.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
