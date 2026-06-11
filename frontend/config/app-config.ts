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
};

export type AppConfig = {
  features: {
    /**
     * Master toggle for the main chat console on the home page (`/`).
     *  - true  → home page shows the full LiteLLM chat console.
     *  - false → home page shows the Qwen model launcher instead, so users
     *            can click a model and open the localhost port serving it.
     */
    chatPage: false;
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
    chatPage: false,
  },
  models: [
    {
      label: "LiteLLM router",
      href: "http://localhost:4000",
      detail: "Auto route dashboard",
      description: "Routes each prompt to the best available local model.",
    },
    {
      label: "qwen3.5:27b",
      href: "http://localhost:8081",
      detail: "Native llama.cpp chat",
      description: "Reasoning, analysis, and planning at full precision.",
    },
    {
      label: "qwen3.6:9b",
      href: "http://localhost:8182",
      detail: "Native llama.cpp chat",
      description: "Fast general-purpose chat for everyday prompts.",
    },
    {
      label: "qwen-coder-next",
      href: "http://localhost:8181",
      detail: "Native llama.cpp chat",
      description: "Code generation, debugging, and refactors.",
    },
  ],
};
