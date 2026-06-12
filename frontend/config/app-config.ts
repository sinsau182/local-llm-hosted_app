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
   * When true, clicking the card auto-logs into LiteLLM using the
   * NEXT_PUBLIC_LITELLM_* env vars instead of opening `href` directly.
   */
  autoLogin?: boolean;
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
  };
  /**
   * Local model runners. Used by the chat page sidebar AND the launcher view
   * shown when `features.chatPage` is turned off.
   */
  models: QwenModel[];
};

export const appConfig: AppConfig = {
  features: {
    // 👇 Flip this to false to hide the chat console and show the model launcher.
    // true = backend-routed in-app chat is the home page (Option A); the native
    // model UIs remain available as links in the sidebar.
    chatPage: false,
  },
  // Native UIs are published through the single breachlabz domain (Caddy):
  //  - llama.cpp UIs are path-proxied under /models/* (relative assets + API).
  //  - LiteLLM UI is on its own TLS port (NEXT_PUBLIC_LITELLM_URL) so its /v1
  //    API on :4001 stays untouched for OpenWebUI and the platform backend.
  // Paths are relative so they resolve against whatever origin serves the app.
  models: [
    {
      label: "LiteLLM router",
      href: `${process.env.NEXT_PUBLIC_LITELLM_URL ?? "http://localhost:4001"}/ui/chat`,
      detail: "Admin UI · auto-login",
      description: "Routes each prompt to the best available local model. Click to log straight into the LiteLLM admin UI using the configured credentials.",
      autoLogin: true,
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
