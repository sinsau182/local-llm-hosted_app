"use client";

import type { ReactNode } from "react";

const LITELLM_URL = process.env.NEXT_PUBLIC_LITELLM_URL ?? "http://localhost:4001";
const LITELLM_USERNAME = process.env.NEXT_PUBLIC_LITELLM_USERNAME ?? "admin";
const LITELLM_PASSWORD = process.env.NEXT_PUBLIC_LITELLM_PASSWORD ?? "";

/** Default page to land on after a successful login. */
const DEFAULT_TARGET = `${LITELLM_URL}/ui/chat/`;

/**
 * Logs into LiteLLM using credentials from the environment, then opens the
 * target page (the chat playground by default) in a new tab — already
 * authenticated, so the user never sees the login screen.
 *
 * LiteLLM enables credentialed CORS for this origin, so the login `fetch`
 * sets the auth cookie in the browser; the subsequently opened tab carries it.
 */
async function launchLiteLlm(target: string) {
  // Open the tab synchronously inside the click handler so it isn't blocked
  // as a popup; we point it at the real page once login completes.
  const tab = window.open("about:blank", "_blank");

  try {
    const body = new URLSearchParams({
      username: LITELLM_USERNAME,
      password: LITELLM_PASSWORD,
    });

    // Use "no-cors": LiteLLM's /login response sets `Access-Control-Allow-Origin: *`,
    // which is illegal for a credentialed CORS request and makes a normal fetch
    // throw. In no-cors mode the request still sends and the browser still stores
    // the auth cookie; we just get an opaque response we don't need to read.
    await fetch(`${LITELLM_URL}/login`, {
      method: "POST",
      mode: "no-cors",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    // The auth cookie is now set, so a direct navigation to the chat page stays
    // there (verified end-to-end with a headless browser).
    if (tab) {
      tab.location.href = target;
    }
  } catch (error) {
    // Login could not complete — fall back to the LiteLLM login screen so the
    // user can sign in manually instead of being stranded on a blank tab.
    if (tab) {
      tab.location.href = `${LITELLM_URL}/ui/chat`;
    }
    console.error("LiteLLM auto-login failed:", error);
  }
}

/**
 * Renders its children as a clickable element that auto-logs into LiteLLM and
 * opens the chat playground. `target` overrides the post-login destination;
 * `className` is applied to the wrapping button so it can match nearby cards.
 */
export function LiteLlmLaunchButton({
  children,
  className,
  target = DEFAULT_TARGET,
}: {
  children: ReactNode;
  className?: string;
  target?: string;
}) {
  return (
    <button type="button" onClick={() => void launchLiteLlm(target)} className={className}>
      {children}
    </button>
  );
}
