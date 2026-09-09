import { AuthView } from "@neondatabase/auth-ui";

export const dynamicParams = false;

export function generateStaticParams() {
  return [
    { path: "sign-in" },
    { path: "sign-up" },
    { path: "forgot-password" },
    { path: "reset-password" },
    { path: "sign-out" },
    { path: "callback" },
  ];
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <AuthView path={path} />
    </div>
  );
}
