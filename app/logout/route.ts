import { NextResponse } from "next/server";

// ProConnect returns here after Single Logout (post_logout_redirect_uri).
// The local session is already cleared; send the user straight to the home page.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/", request.url));
}
