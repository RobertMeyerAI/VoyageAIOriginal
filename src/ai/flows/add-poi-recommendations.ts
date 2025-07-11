// src/ai/flows/add-poi-recommendations.ts
'use server';

/**
 * @fileOverview Provides AI-powered point-of-interest recommendations for a given travel plan.
 *
 * - addPoiRecommendations - A function to generate point-of-interest recommendations.
 * - AddPoiRecommendationsInput - The input type for the function.
 * - AddPoiRecommendationsOutput - The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AddPoiRecommendationsInputSchema = z.object({
  destination: z.string().describe('The destination city for which to provide recommendations (e.g., "Paris, France").'),
  travelerProfile: z.string().describe('A description of the traveler and their preferences (e.g., "A family with young children who enjoy historical sites").'),
  tripType: z.enum(['sightseeing', 'adventure', 'relaxation', 'business']).describe('The type of the trip.'),
  interests: z.string().describe('A comma separated list of interests of the user.'),
});
export type AddPoiRecommendationsInput = z.infer<typeof AddPoiRecommendationsInputSchema>;

const AddPoiRecommendationsOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      name: z.string().describe('The name of the recommended point of interest.'),
      type: z.enum(['restaurant', 'activity', 'sight']).describe('The type of point of interest.'),
      description: z.string().describe('A brief description of the point of interest and why it is recommended.'),
      location: z.string().describe('The address of the point of interest.'),
      rating: z.number().optional().describe('The average rating of the point of interest, if available.'),
      priceRange: z.string().optional().describe('The typical price range (e.g., $, $$, $$$), if applicable.'),
      openingHours: z.string().optional().describe('The common opening hours of this place'),
    })
  ).describe('A list of point-of-interest recommendations.'),
  progress: z.string().describe('One sentence summary of what has been generated')
});
export type AddPoiRecommendationsOutput = z.infer<typeof AddPoiRecommendationsOutputSchema>;

export async function addPoiRecommendations(input: AddPoiRecommendationsInput): Promise<AddPoiRecommendationsOutput> {
  return addPoiRecommendationsFlow(input);
}

const addPoiRecommendationsPrompt = ai.definePrompt({
  name: 'addPoiRecommendationsPrompt',
  input: {schema: AddPoiRecommendationsInputSchema},
  output: {schema: AddPoiRecommendationsOutputSchema},
  prompt: `You are an expert travel assistant. A traveler is planning a trip to {{{destination}}} and needs recommendations for points of interest.

  The traveler's profile: {{{travelerProfile}}}
  Trip Type: {{{tripType}}}
  Interests: {{{interests}}}

  Provide a list of diverse recommendations, including restaurants, activities, and must-see spots, tailored to their interests and trip type.

  Output the recommendations in JSON format.
  {
    "recommendations": [
      {
        "name": "Point of Interest Name",
        "type": "restaurant | activity | sight",
        "description": "Why this is a great recommendation for the traveler.",
        "location": "The address of the location",
        "rating": 4.5,
        "priceRange": "$$",
        openingHours: "9AM - 5PM",
      }
    ],
    "progress": "Generated three personalized point-of-interest recommendations for the traveler's upcoming trip."
  }`,
});

const addPoiRecommendationsFlow = ai.defineFlow(
  {
    name: 'addPoiRecommendationsFlow',
    inputSchema: AddPoiRecommendationsInputSchema,
    outputSchema: AddPoiRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await addPoiRecommendationsPrompt(input);
    return output!;
  }
);
