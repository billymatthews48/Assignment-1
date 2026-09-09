export type Priority = "high" | "medium" | "low";

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  role: string | null;
  met_at: string | null;
  notes: string | null;
  priority: Priority;
  created_at: string;
  updated_at: string;
}

export type ContactInput = {
  name: string;
  company: string;
  role: string;
  met_at: string;
  notes: string;
  priority: Priority;
};

export type SortKey = "name" | "company" | "priority" | "met_at" | "created_at";
export type SortDirection = "asc" | "desc";
