import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Anmelden – Verwaltung",
  robots: { index: false, follow: false },
};

// Die Anmeldeseite darf nie aus einem Cache kommen.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { valid } = await getSession();
  if (valid) redirect("/app");

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Verwaltung</h1>
        <p className="login-intro">Bitte melde dich an, um fortzufahren.</p>
        <LoginForm />
      </div>
    </main>
  );
}
