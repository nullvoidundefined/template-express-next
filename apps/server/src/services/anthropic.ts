import Anthropic from '@anthropic-ai/sdk';
import { env } from 'app/config/env.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export { anthropic };
