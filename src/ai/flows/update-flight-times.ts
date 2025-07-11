
'use server';
/**
 * @fileOverview Fetches real-time flight data for a single flight using AI.
 *
 * - updateFlightTimes - A function that gets updated flight details.
 * - UpdateFlightTimesInput - The input type for a function.
 * - UpdateFlightTimesOutput - The return type for a function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UpdateFlightTimesInputSchema = z.object({
  ident: z.string().describe('The flight identifier (IATA airline code + flight number, e.g., "UA123").'),
  date: z.string().describe('The departure date in YYYY-MM-DD format.'),
});
export type UpdateFlightTimesInput = z.infer<typeof UpdateFlightTimesInputSchema>;

const UpdateFlightTimesOutputSchema = z.object({
    status: z.string().optional().describe('A brief, real-time status of the flight (e.g., "On Time", "Delayed 30 min", "Landed", "En-Route").'),
    updatedStartDate: z.string().optional().describe('The updated departure time in ISO 8601 format.'),
    updatedEndDate: z.string().optional().describe('The updated arrival time in ISO 8601 format.'),
});
export type UpdateFlightTimesOutput = z.infer<typeof UpdateFlightTimesOutputSchema>;

export async function updateFlightTimes(input: UpdateFlightTimesInput): Promise<UpdateFlightTimesOutput> {
    return updateFlightTimesFlow(input);
}

const updateFlightTimesPrompt = ai.definePrompt({
    name: 'updateFlightTimesPrompt',
    input: {schema: UpdateFlightTimesInputSchema},
    output: {schema: UpdateFlightTimesOutputSchema},
    prompt: `You are a real-time flight tracking assistant AI with access to the latest flight data.
Your task is to provide the most current status for a specific flight based on the provided flight identifier and date.

**Flight Details**:
- **Flight Identifier**: {{{ident}}} (This is the IATA airline code + flight number, e.g., "UA123")
- **Date**: {{{date}}} (This is the scheduled departure date in YYYY-MM-DD format)

**CRITICAL INSTRUCTIONS**:
1.  **Act as a Real-Time Tracker**: You MUST use your knowledge to find the current, live status of this flight.
2.  **Provide a Status String**: The 'status' field must be a concise, human-readable summary. Examples: "On Time", "Delayed 30 min", "Landed at 3:15 PM", "En-Route", "Cancelled". **If the flight's current departure or arrival time is later than scheduled, the status MUST include the word "Delayed" (e.g., "Delayed & En-Route").**
3.  **Update Timestamps (MANDATORY)**: You MUST provide the most accurate 'updatedStartDate' (departure time) and 'updatedEndDate' (arrival time) you can find. These should be in full ISO 8601 format (YYYY-MM-DDTHH:mm:ss). These can be the scheduled, estimated, or actual times, whichever is most current and accurate. **Even if the flight is on time, you must return the scheduled times in these fields.** Do not leave them blank.
4.  **Output Format**: Return ONLY a valid JSON object that strictly adheres to the schema. Do not add any commentary, markdown, or extra text.`,
});

const updateFlightTimesFlow = ai.defineFlow(
    {
        name: 'updateFlightTimesFlow',
        inputSchema: UpdateFlightTimesInputSchema,
        outputSchema: UpdateFlightTimesOutputSchema,
    },
    async (input) => {
        const {output} = await updateFlightTimesPrompt(input);
        return output!;
    }
);
