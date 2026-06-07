import { auth, getProconnectDiscovery } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Full ProConnect logout (Single Logout) :
// 1. retrieve the stored id_token for the ProConnect account (id_token_hint) ;
// 2. delete the local session (better-auth) ;
// 3. redirect to the ProConnect end_session_endpoint to close the session
//    on the identity provider side, which will then redirect to the home page.
export async function GET(request: Request) {
  const requestHeaders = await headers();
  const baseUrl = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;

  const session = await auth.api.getSession({ headers: requestHeaders });

  let idToken: string | undefined;
  if (session) {
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, providerId: "proconnect" },
      orderBy: { updatedAt: "desc" },
    });
    idToken = account?.idToken ?? undefined;
  }

  // Remove the local session ; asResponse to retrieve the Set-Cookie.
  const signOutResponse = await auth.api.signOut({
    headers: requestHeaders,
    asResponse: true,
  });

  // Without an id_token, we can't do the ProConnect logout : redirect to the home page.
  if (!idToken) {
    const redirect = NextResponse.redirect(new URL("/", baseUrl));
    for (const cookie of signOutResponse.headers.getSetCookie()) {
      redirect.headers.append("set-cookie", cookie);
    }
    return redirect;
  }

  const discovery = await getProconnectDiscovery();
  const logoutUrl = new URL(discovery.end_session_endpoint);
  logoutUrl.searchParams.set("id_token_hint", idToken);
  logoutUrl.searchParams.set("post_logout_redirect_uri", `${baseUrl}/`);
  logoutUrl.searchParams.set("state", crypto.randomUUID());

  const redirect = NextResponse.redirect(logoutUrl);
  for (const cookie of signOutResponse.headers.getSetCookie()) {
    redirect.headers.append("set-cookie", cookie);
  }
  return redirect;
}
