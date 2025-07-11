'use server';
/**
 * @fileOverview Suggests transportation options between two points for a budget-conscious traveler.
 *
 * - getTransportationOptions - A function that gets transportation options.
 * - GetTransportationOptionsInput - The input type for the function.
 * - GetTransportationOptionsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetTransportationOptionsInputSchema = z.object({
  origin: z.string().describe('The starting point for the journey (e.g., "JFK Airport, New York, NY" or "Hotel Le Grand, Paris").'),
  destination: z.string().describe('The destination point for the journey (e.g., "Marriott Marquis, Times Square, New York, NY" or "Eiffel Tower, Paris").'),
  travelerProfile: z.string().describe('A description of the traveler\'s preferences, which will be used to rank and select options.'),
});
export type GetTransportationOptionsInput = z.infer<typeof GetTransportationOptionsInputSchema>;

const TransportationOptionSchema = z.object({
    type: z.enum(['WALK', 'SUBWAY', 'BUS', 'TRAIN', 'RIDESHARE', 'TAXI', 'FERRY']).describe('The type of transportation.'),
    name: z.string().describe('The specific name of the service (e.g., "MTA Subway", "UberX", "Paris Metro Line 8", "Big Bus Tours").'),
    description: z.string().describe('A clear, step-by-step description of the route or service.'),
    estimatedCost: z.string().describe('The estimated cost for one person, in a human-readable format (e.g., "$2.90", "€25-€35", "Free").'),
    estimatedDuration: z.string().describe('The estimated total travel time (e.g., "45-60 minutes", "approx. 20 minutes").'),
    proTip: z.string().optional().describe('An optional helpful tip for the traveler related to this option (e.g., "Buy a Navigo Découverte pass for unlimited travel for a week.").'),
    bookingLink: z.string().url().optional().describe('An optional deep link to book or view the service (e.g., a link to the Uber app or a train ticket website).'),
});

const GetTransportationOptionsOutputSchema = z.array(TransportationOptionSchema);
export type GetTransportationOptionsOutput = z.infer<typeof GetTransportationOptionsOutputSchema>;


export async function getTransportationOptions(input: GetTransportationOptionsInput): Promise<GetTransportationOptionsOutput> {
    return getTransportationOptionsFlow(input);
}

const getTransportationOptionsPrompt = ai.definePrompt({
    name: 'getTransportationOptionsPrompt',
    input: {schema: GetTransportationOptionsInputSchema},
    output: {schema: GetTransportationOptionsOutputSchema},
    prompt: `You are a savvy, local travel expert providing transportation advice. A traveler needs to get from a specific origin to a destination.

Analyze the traveler's profile, the origin, and the destination to suggest the best transportation options.

**Traveler Profile**: {{{travelerProfile}}}

**Itinerary**:
- **From**: {{{origin}}}
- **To**: {{{destination}}}

**Instructions**:
1.  **Prioritize Options**: Based on the traveler's profile, generate a list of 2-4 transportation options. Rank them in order of preference, with the most suitable option first. The default preference order is: Walking, Public Transit (Subway, Bus, Train, Ferry), Ride-Sharing (Uber, Lyft), and finally, traditional Taxis.
2.  **Provide Key Details**: For each option, you MUST provide:
    *   'type': A valid transportation type from the enum.
    *   'name': The common name of the service (e.g., "NYC Subway", "Uber", "RER B Train").
    *   'description': Simple, clear directions.
    *   'estimatedCost': A realistic cost estimate for one person (e.g., "$5-$10").
    *   'estimatedDuration': A realistic time estimate (e.g., "30-45 min").
3.  **Add Value**:
    *   If there's a useful 'proTip' (like a ticketing suggestion or a scenic route), include it.
    *   If there is an official or common 'bookingLink' (like a national rail website or ride-sharing app link), include it.
4.  **Be Realistic**: Do not suggest walking if the distance is unreasonable (over 2 miles or 3 km). Only suggest options that are practical and commonly used for the given route. If the origin and destination are very close, you might only suggest walking.
5.  **Output Format**: Return ONLY a valid JSON array of options that strictly adheres to the schema. Do not add any commentary, markdown, or extra text. If no reasonable options can be found, return an empty array.`,
});


const getTransportationOptionsFlow = ai.defineFlow(
    {
        name: 'getTransportationOptionsFlow',
        inputSchema: GetTransportationOptionsInputSchema,
        outputSchema: GetTransportationOptionsOutputSchema,
    },
    async (input) => {
        const {output} = await getTransportationOptionsPrompt(input);
        return output || [];
    }
);
