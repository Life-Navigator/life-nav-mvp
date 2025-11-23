import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

/**
 * NextAuth-compatible session endpoint.
 *
 * This endpoint integrates the custom JWT-based auth system with NextAuth's
 * SessionProvider, which expects a /api/auth/session endpoint.
 *
 * Returns a session object compatible with next-auth/react's useSession hook.
 */

interface JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  role?: string;
  tenant_id?: string;
  exp: number;
  iat: number;
  type?: string;
  // Pilot access fields
  pilotRole?: string;
  pilotEnabled?: boolean;
  userType?: string;
}

export async function GET(req: NextRequest) {
  try {
    // Try to get token from cookies first
    const cookieStore = await cookies();
    let token = cookieStore.get("access_token")?.value || null;

    // If not in cookies, try Authorization header
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    // No token = no session (return null session, not an error)
    if (!token) {
      return NextResponse.json(null, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // Verify token
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("JWT_SECRET not configured");
      return NextResponse.json(null, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    try {
      const decoded = jwt.verify(token, secret) as JWTPayload;

      // Verify it's an access token (not refresh token)
      if (decoded.type && decoded.type !== "access") {
        return NextResponse.json(null, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        });
      }

      // Build NextAuth-compatible session response
      const session = {
        user: {
          id: decoded.sub,
          email: decoded.email || null,
          name: decoded.name || null,
          role: decoded.role || "user",
          // Pilot access fields
          pilotRole: decoded.pilotRole || null,
          pilotEnabled: decoded.pilotEnabled || false,
          userType: decoded.userType || null,
        },
        expires: new Date(decoded.exp * 1000).toISOString(),
      };

      return NextResponse.json(session, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    } catch (jwtError) {
      // Invalid or expired token
      console.error("JWT verification failed:", jwtError);
      return NextResponse.json(null, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }
  } catch (error) {
    console.error("Session endpoint error:", error);
    return NextResponse.json(null, {
      status: 500,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }
}
