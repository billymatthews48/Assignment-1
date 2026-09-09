import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          Stay connected with the people who matter
        </h1>
        <p className="mt-4 text-base text-zinc-600 sm:text-lg">
          A private networking tracker for the contacts you meet at Berkeley —
          who they are, where you met, and how important it is to follow up.
          Every contact is visible only to you, enforced at the database level.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/auth/sign-up"
            className="w-full rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 sm:w-auto"
          >
            Create an account
          </Link>
          <Link
            href="/auth/sign-in"
            className="w-full rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
