import { ContactsClient } from "./ContactsClient";

// This page's content depends entirely on client-side auth/session state
// (there's nothing to render for it at build time), so it must not be
// statically prerendered — force per-request dynamic rendering instead.
export const dynamic = "force-dynamic";

export default function ContactsPage() {
  return <ContactsClient />;
}
