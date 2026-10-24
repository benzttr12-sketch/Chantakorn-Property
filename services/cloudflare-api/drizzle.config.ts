import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle-generated',
  // Human-reviewed Wrangler migrations in migrations/ are the deployment source of truth.
  // Generated migrations are proposals and must not be applied directly to production.
});
