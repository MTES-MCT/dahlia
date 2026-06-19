// Direct database access for the Playwright tests (e.g. simulating an admin
// validating a freshly-created account). Uses a standalone Prisma client rather
// than the app singleton so it works outside the Next.js runtime.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DATABASE_URL } from "../constants";

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

// Mark a user as validated by email (an admin does this manually in real life,
// see app/(protected)/layout.tsx). Returns whether a row was updated.
export async function validateUser(email: string): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { email },
    data: { validated: true },
  });
  return result.count > 0;
}

// Remove the test agent's account so each run starts from a clean auth state.
export async function deleteUser(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } });
}
