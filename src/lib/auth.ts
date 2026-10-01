// Credentials-based auth (email + password), self-hosted, free — no third
// party auth service. Session is a signed JWT cookie (edge-compatible,
// works on Cloudflare Pages/Workers where there's no server-side session
// store by default).
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "./cf";
import { getUserByEmail } from "./db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      locale: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const db = getDb();
        const user = await getUserByEmail(db, email);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.display_name ?? undefined,
          locale: user.locale,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as { id: string }).id;
        token.locale = (user as { locale?: string }).locale ?? "he";
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.locale = (token.locale as string) ?? "he";
      }
      return session;
    },
  },
  trustHost: true,
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
