import { NextRequest, NextResponse } from "next/server";

// Static provider configuration to avoid NextAuth rate limiting
const STATIC_PROVIDERS = {
  credentials: {
    id: "credentials",
    name: "Credentials",
    type: "credentials",
    signinUrl: "/api/auth/signin/credentials",
    callbackUrl: "/api/auth/callback/credentials"
  },
  google: {
    id: "google",
    name: "Google",
    type: "oauth",
    signinUrl: "/api/auth/signin/google",
    callbackUrl: "/api/auth/callback/google"
  },
  "azure-ad": {
    id: "azure-ad",
    name: "Azure Active Directory",
    type: "oauth",
    signinUrl: "/api/auth/signin/azure-ad",
    callbackUrl: "/api/auth/callback/azure-ad"
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    type: "oauth",
    signinUrl: "/api/auth/signin/linkedin",
    callbackUrl: "/api/auth/callback/linkedin"
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    type: "oauth",
    signinUrl: "/api/auth/signin/facebook",
    callbackUrl: "/api/auth/callback/facebook"
  }
};

export async function GET(req: NextRequest) {
  // Return static providers instantly to avoid NextAuth rate limiting
  return NextResponse.json(STATIC_PROVIDERS, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}