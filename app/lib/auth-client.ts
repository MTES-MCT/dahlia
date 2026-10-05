"use client";

import { createAuthClient } from "better-auth/react";

// Generic OAuth providers are registered as social providers in Better Auth 1.7.
// Sign-in goes through `signIn.social`; no client plugin is required.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
