"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { destroySession, login } from "@/lib/auth";

/**
 * Mutationen laufen ueber Server Actions statt ueber Route Handler: Next.js
 * prueft bei Server Actions Origin und Host gegeneinander und faengt damit
 * CSRF ab, ohne dass eigene Token noetig waeren.
 */

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Bitte gib das Passwort ein." };

  const userAgent = (await headers()).get("user-agent") ?? undefined;
  const result = await login(password, userAgent);

  if (result.ok) redirect("/app");

  switch (result.reason) {
    case "locked": {
      const minutes = Math.ceil(result.retryAfterSeconds / 60);
      return {
        error: `Zu viele Fehlversuche. Bitte versuche es in ${minutes} Minute${
          minutes === 1 ? "" : "n"
        } erneut.`,
      };
    }
    case "not_configured":
      return {
        error:
          "Es ist noch kein Zugang eingerichtet. ADMIN_PASSWORD_HASH muss in den Umgebungsvariablen gesetzt sein.",
      };
    default:
      return { error: "Passwort falsch." };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
