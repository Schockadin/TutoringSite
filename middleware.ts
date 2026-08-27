import { type NextRequest, NextResponse } from "next/server";

/**
 * NUR Bequemlichkeit: leitet ohne Sitzungs-Cookie direkt zur Anmeldung um,
 * damit kein Seitenaufbau umsonst laeuft.
 *
 * Das ist ausdruecklich KEINE Autorisierung. Geprueft wird hier nur, ob ein
 * Cookie ueberhaupt existiert – nicht, ob es gueltig ist. Die echte Pruefung
 * liegt im Layout des Verwaltungsbereichs gegen die Datenbank. Next.js hatte
 * mit CVE-2025-29927 eine Luecke, mit der sich Middleware umgehen liess;
 * Autorisierung gehoert deshalb in die Datenschicht, nicht an den Rand.
 */
export function middleware(request: NextRequest) {
  const hasCookie =
    request.cookies.has("__Host-session") || request.cookies.has("session");

  if (!hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
