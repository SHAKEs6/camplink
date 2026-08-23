# Welcome to your Lovable project

TODO: Document your project here
# camplink

## Assistant and security configuration

The Camplink Assistant runs through the `ai-chat` Supabase Edge Function. Set these Supabase secrets before deploying it:

- `AI_PROVIDER_API_KEY` - server-side provider key; never add this to Vite environment variables.
- `AI_MODEL` - optional model name, default `gpt-4o-mini`.
- `AI_BASE_URL` - optional OpenAI-compatible API base URL.

Apply the AI migration and deploy the function with `supabase db push` and `supabase functions deploy ai-chat`. The assistant validates the caller, limits requests in the database, retrieves only the signed-in user's own profile/orders, and has no action tools for payments, refunds, withdrawals, passwords, or administration.

The current app is a browser-only Vite SPA using Supabase Auth. Supabase's browser client persists its refresh session in its configured storage and uses automatic token refresh plus cross-tab storage events. This provides synchronized session state, but a browser SPA cannot create a true `HttpOnly` authentication cookie. To meet a strict `HttpOnly`-only policy, deploy a same-origin server/BFF using `@supabase/ssr`, move sign-in/session exchange behind that server, and proxy authenticated data requests through it; do not place the Supabase tokens in a JavaScript-readable cookie as a workaround.
