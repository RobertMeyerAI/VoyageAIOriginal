
'use server';
/**
 * @fileOverview Generates an image for a travel destination.
 *
 * - generateTripImage - Generates an image based on a destination.
 * - GenerateTripImageInput - The input type for the function.
 * - GenerateTripImageOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTripImageInputSchema = z.object({
  destination: z.string().describe('The travel destination (e.g., "Paris, France").'),
});
export type GenerateTripImageInput = z.infer<typeof GenerateTripImageInputSchema>;


const GenerateTripImageOutputSchema = z.object({
    imageUrl: z.string().url().describe('The URL of the generated image.'),
});
export type GenerateTripImageOutput = z.infer<typeof GenerateTripImageOutputSchema>;

export async function generateTripImage(input: GenerateTripImageInput): Promise<GenerateTripImageOutput> {
  return generateTripImageFlow(input);
}

const generateTripImageFlow = ai.defineFlow(
    {
      name: 'generateTripImageFlow',
      inputSchema: GenerateTripImageInputSchema,
      outputSchema: GenerateTripImageOutputSchema,
    },
    async (input) => {
        const {media} = await ai.generate({
            model: 'googleai/gemini-2.0-flash-preview-image-generation',
            prompt: `A beautiful, vibrant, high-quality photograph of ${input.destination}. Cinematic style, professional travel photography.`,
            config: {
                responseModalities: ['IMAGE'],
            },
        });
        
        if (!media || !media.url) {
            throw new Error('Image generation failed to return an image.');
        }

        return { imageUrl: media.url };
    }
);
