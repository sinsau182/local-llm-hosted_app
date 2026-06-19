"use client";

import type { ReactNode } from "react";

const LIBRECHAT_URL =
  process.env.NEXT_PUBLIC_LIBRECHAT_URL ?? "http://localhost:3080";
const LIBRECHAT_EMAIL = process.env.NEXT_PUBLIC_LIBRECHAT_EMAIL ?? "";
const LIBRECHAT_PASSWORD = process.env.NEXT_PUBLIC_LIBRECHAT_PASSWORD ?? "";

/** Default page to land on after a successful login. */
const DEFAULT_TARGET = `${LIBRECHAT_URL}/`;

/**
 * Logs into LibreChat using credentials from the environment, then opens the
 * target page in a new tab — already authenticated, so the user never sees the
 * login screen.
 *
 * LibreChat's login needs a JSON body, so this is a real credentialed CORS
 * request (mode: "cors"). LibreChat itself sends `Access-Control-Allow-Origin: *`
 * (illegal with credentials), so Caddy fronts LibreChat on :4444 and rewrites
 * the CORS headers to pin this exact origin + allow credentials. The login
 * response sets the httpOnly `refreshToken` cookie (same-site with this app's
 * domain); the opened tab then auto-refreshes an access token from it.
 */
async function launchLibreChat(target: string) {
  // Open the tab synchronously inside the click handler so it isn't blocked
  // as a popup; we point it at the real page once login completes.
  const tab = window.open("about:blank", "_blank");

  try {
    await fetch(`${LIBRECHAT_URL}/api/auth/login`, {
      method: "POST",
      mode: "cors",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: LIBRECHAT_EMAIL,
        password: LIBRECHAT_PASSWORD,
      }),
    });

    // refreshToken cookie is now set; a fresh tab will refresh an access token.
    if (tab) {
      tab.location.href = target;
    }
  } catch (error) {
    // Login could not complete — fall back to the LibreChat login screen so the
    // user can sign in manually instead of being stranded on a blank tab.
    if (tab) {
      tab.location.href = `${LIBRECHAT_URL}/login`;
    }
    console.error("LibreChat auto-login failed:", error);
  }
}

/**
 * Renders its children as a clickable element that auto-logs into LibreChat and
 * opens it. `target` overrides the post-login destination; `className` is
 * applied to the wrapping button so it can match nearby cards.
 */
export function LibreChatLaunchButton({
  children,
  className,
  target = DEFAULT_TARGET,
}: {
  children: ReactNode;
  className?: string;
  target?: string;
}) {
  return (
    <button type="button" onClick={() => void launchLibreChat(target)} className={className}>
      {children}
    </button>
  );
}
