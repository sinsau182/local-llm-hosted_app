/**
 * ============================================================================
 *  BreachLabz — Global Master Config
 * ============================================================================
 *  Single source of truth for high-level UI feature toggles and the list of
 *  local Qwen model runners. Flip a flag here to turn whole features on/off
 *  across the app — no component edits required.
 * ============================================================================
 */

export type QwenModel = {
  /** Display name shown on the card. */
  label: string;
  /** localhost URL of the native chat UI serving this model. */
  href: string;
  /** Short tagline under the label. */
  detail: string;
  /** Optional longer description shown in the launcher view. */
  description?: string;
  /**
   * When set, clicking the card auto-logs into the named service (using that
   * service's NEXT_PUBLIC_* env vars) instead of opening `href` directly.
   *   - "litellm"   → LiteLLM admin UI
   *   - "librechat" → LibreChat chat UI
   */
  launcher?: "litellm" | "librechat";
};

export type AppConfig = {
  features: {
    /**
     * Master toggle for the main chat console on the home page (`/`).
     *  - true  → home page shows the full LiteLLM chat console.
     *  - false → home page shows the Qwen model launcher instead, so users
     *            can click a model and open the localhost port serving it.
     */
    chatPage: boolean;
    /**
     * Toggle for the Dashboard tab in the top navigation.
     *  - true  → the Dashboard link is shown in the header nav.
     *  - false → the Dashboard link is hidden.
     */
    dashboardTab: boolean;
  };
  /**
   * Base URL of the simplified ComfyUI surface users are sent to for image /
   * video creation. Source of truth: NEXT_PUBLIC_COMFYUI_URL in the root master
   * `.env` (baked in at build time). The redirect box appends `?user=<uid>` so
   * ComfyUI can attribute generated assets to the signed-in user.
   */
  comfyuiUrl: string;
  /**
   * Local model runners. Used by the chat page sidebar AND the launcher view
   * shown when `features.chatPage` is turned off.
   */
  models: QwenModel[];
};

/**
 * Parse a NEXT_PUBLIC_* boolean flag from the root master `.env` (baked in at
 * build time). Falls back to `fallback` when the var is unset. Toggle these in
 * the root `.env`, NOT here — then rebuild the frontend.
 */
function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }
  return value === "true" || value === "1";
}

export const appConfig: AppConfig = {
  features: {
    // Source of truth: NEXT_PUBLIC_FEATURE_CHAT_PAGE in the root master .env.
    // true = backend-routed in-app chat is the home page; false = model launcher.
    chatPage: envFlag(process.env.NEXT_PUBLIC_FEATURE_CHAT_PAGE, false),
    // Source of truth: NEXT_PUBLIC_FEATURE_DASHBOARD_TAB in the root master .env.
    // false hides the Dashboard tab from the header nav (and 404s the route).
    dashboardTab: envFlag(process.env.NEXT_PUBLIC_FEATURE_DASHBOARD_TAB, false),
  },
  // Simplified ComfyUI surface for image/video creation (Caddy :8443 route by
  // default). Override with NEXT_PUBLIC_COMFYUI_URL in the root master .env.
  // Empty/unset falls back to the default (mirrors envFlag()).
  comfyuiUrl:
    process.env.NEXT_PUBLIC_COMFYUI_URL ||
    "https://breachlabz-nucbox-evo-x2.tailcf3262.ts.net:8443",
  // Native UIs are published through the single breachlabz domain (Caddy):
  //  - llama.cpp UIs are path-proxied under /models/* (relative assets + API).
  //  - LiteLLM UI is on its own TLS port (NEXT_PUBLIC_LITELLM_URL) so its /v1
  //    API on :4001 stays untouched for OpenWebUI and the platform backend.
  // Paths are relative so they resolve against whatever origin serves the app.
  models: [
    {
      label: "LibreChat",
      href: process.env.NEXT_PUBLIC_LIBRECHAT_URL ?? "http://localhost:3080",
      detail: "Chat UI · auto-login",
      description: "Full chat interface for all local Qwen models, with file uploads. Click to open already signed in.",
      launcher: "librechat",
    },
    {
      label: "Qwen 27B",
      href: "/models/qwen-27b/",
      detail: "Reasoning model",
      description: "Reasoning model — analysis and planning.",
    },
    {
      label: "Qwen 9B",
      href: "/models/qwen-9b/",
      detail: "General purpose model",
      description: "General purpose model for everyday chat.",
    },
    {
      label: "Qwen Coder",
      href: "/models/qwen-coder/",
      detail: "Coding model",
      description: "Coding model — generation, debugging, and refactors.",
    },
  ],
};
