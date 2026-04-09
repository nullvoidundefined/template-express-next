// Load env / secrets before any app modules initialize
import 'dotenv/config';

await import('app/app.js');
