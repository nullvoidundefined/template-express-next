// Load env / secrets before any app modules initialize.
// The listener + lifecycle live in server.ts, imported dynamically so this
// dotenv side-effect import runs before any module reads process.env.
import 'dotenv/config';

await import('app/server.js');
