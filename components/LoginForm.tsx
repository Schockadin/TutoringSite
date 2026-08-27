"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "@/lib/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Wird geprüft…" : "Anmelden"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction}>
      {/* Verstecktes Benutzerfeld, damit Passwortmanager den Eintrag sauber
          zuordnen koennen. Serverseitig wird es ignoriert. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        defaultValue="dominic"
        hidden
        readOnly
      />
      <div className="form-row">
        <label htmlFor="password">Passwort</label>
        <input
          type="password"
          id="password"
          name="password"
          autoComplete="current-password"
          required
          autoFocus
          className={state.error ? "invalid" : undefined}
        />
        <span className="error-msg">{state.error}</span>
      </div>
      <SubmitButton />
    </form>
  );
}
