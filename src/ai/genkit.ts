import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const config = {
  plugins: [
    googleAI({apiKey: process.env.GOOGLE_API_KEY})
  ],
  model: 'googleai/gemini-1.5-flash',
};

export const ai = genkit(config);
