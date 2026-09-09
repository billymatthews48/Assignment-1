import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";
import type { Contact } from "./types";

type Database = {
  public: {
    Tables: {
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at"> &
          Partial<Pick<Contact, "user_id">>;
        Update: Partial<Omit<Contact, "id" | "user_id" | "created_at" | "updated_at">>;
      };
    };
  };
};

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;

export const isNeonConfigured = Boolean(authUrl && dataApiUrl);

/**
 * Single client for both Neon Managed Better Auth and the Neon Data API.
 * The frontend calls this directly (no custom backend CRUD endpoints) — the
 * Data API validates the user's session JWT on every request and Postgres
 * Row Level Security (see db/schema.sql) confines each user to their own
 * contacts rows.
 */
export const neon = createClient<Database>({
  auth: {
    url: authUrl ?? "https://neon-not-configured.invalid/auth",
    adapter: BetterAuthReactAdapter(),
  },
  dataApi: {
    url: dataApiUrl ?? "https://neon-not-configured.invalid/rest/v1",
  },
});
