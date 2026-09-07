declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_MODE_PASSWORD_PRIMARY?: string;
    ADMIN_MODE_PASSWORD_SECONDARY?: string;
  }
}
