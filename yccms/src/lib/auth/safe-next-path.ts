/**
 * Post-login redirect target from `?next=`. Only same-origin absolute paths are allowed, so the login page
 * cannot be abused as an open redirect (`//evil.com`, `/\evil.com`, `https://…`, `javascript:` all fall back to "/").
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f]/.test(next)) return "/";
  return next;
}
