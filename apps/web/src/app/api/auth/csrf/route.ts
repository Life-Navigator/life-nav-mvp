import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/auth/csrf";

/**
 * NextAuth-compatible CSRF token endpoint.
 *
 * Returns a CSRF token in the format expected by NextAuth's SessionProvider.
 */
export async function GET() {
  try {
    const csrfToken = await generateCsrfToken();

    return NextResponse.json(
      { csrfToken },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("CSRF token generation error:", error);
    // Return a placeholder token on error to prevent crashes
    return NextResponse.json(
      { csrfToken: "csrf_error_token" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
