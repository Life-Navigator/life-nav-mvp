import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import LinkedInProvider from "next-auth/providers/linkedin";
import AzureADProvider from "next-auth/providers/azure-ad";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import type { DefaultSession } from 'next-auth';

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      setupCompleted?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    setupCompleted?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    setupCompleted?: boolean;
  }
}

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('NEXTAUTH_SECRET must be set in production environment');
}

// Define complete auth options here
export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-only-for-local',
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
    newUser: '/onboarding/interactive',
  },
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log('[AUTH] ==> Authorize called with email:', credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] ==> Missing credentials');
          return null;
        }

        // Demo mode - bypass database for demo account
        if (credentials.email === 'demo@example.com' && credentials.password === 'demo') {
          console.log('[AUTH] ==> Demo mode activated');
          return {
            id: 'demo-user-id',
            email: 'demo@example.com',
            name: 'Demo User',
            image: null,
            setupCompleted: true,
          };
        }

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email },
          });

          console.log('[AUTH] ==> User found:', user ? 'YES' : 'NO');

          if (!user || !user.password) {
            console.log('[AUTH] ==> User not found or no password');
            return null;
          }

          const passwordValid = await compare(credentials.password, user.password);
          console.log('[AUTH] ==> Password valid:', passwordValid);

          if (!passwordValid) {
            console.log('[AUTH] ==> Invalid password');
            return null;
          }

          // Update last login
          await db.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });

          const returnUser = {
            id: user.id,
            email: user.email!,
            name: user.name,
            image: user.image,
            setupCompleted: user.setupCompleted,
          };

          console.log('[AUTH] ==> Returning user:', returnUser.id, returnUser.email);
          return returnUser;
        } catch (error) {
          console.error('[AUTH] ==> Error in authorize:', error);
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID || "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
    }),
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.setupCompleted = user.setupCompleted;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.setupCompleted = token.setupCompleted as boolean;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
