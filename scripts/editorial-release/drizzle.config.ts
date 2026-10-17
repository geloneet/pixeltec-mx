import {defineConfig} from 'drizzle-kit';
// Separate journal, no database access or production migration hook.
export default defineConfig({dialect:'postgresql',schema:'./scripts/editorial-release/schema.ts',out:'./drizzle/editorial-release'});
