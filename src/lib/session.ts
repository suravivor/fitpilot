import { auth } from "./auth";

/** Returns the signed-in user's id, or null if there is no session. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
