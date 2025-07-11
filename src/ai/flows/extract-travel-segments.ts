
'use server';
/**
 * @fileOverview Extracts detailed travel segments from a single email's text and attachments.
 *
 * - extractTravelSegments - A function that finds all travel segments in an email.
 * - ExtractTravelSegmentsInput - The input type for the function.
 * - ExtractTravelSegmentsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractTravelSegmentsInputSchema = z.object({
  emailText: z.string().describe('The text content of the travel-related email.'),
  imageAttachments: z.array(z.object({
    filename: z.string(),
    mimeType: z.string(),
    dataUri: z.string().describe("A Base64-encoded data URI of an image attached to the email. Expected format: 'data:image/...;base64,...'"),
  })).optional().describe('An array of image attachments from the email.'),
});
export type ExtractTravelSegmentsInput = z.infer<typeof ExtractTravelSegmentsInputSchema>;

const TravelSegmentSchema = z.object({
  type: z.enum(['FLIGHT', 'HOTEL', 'TRAIN', 'CAR']).describe('The type of the travel segment.'),
  description: z.string().describe('A detailed summary of the segment (e.g., "Flight from JFK to CDG on Air France, AF009" or "3 nights at Hotel Le Grand, Paris").'),
  startDate: z.string().describe('The start date and time of this segment in full ISO 8601 format (YYYY-MM-DDTHH:mm:ss). For flights, this is the departure time.'),
  endDate: z.string().describe('The end date and time of this segment in full ISO 8601 format (YYYY-MM-DDTHH:mm:ss). For flights, this is the arrival time.'),
  location: z.string().describe('The primary city or location for this segment (e.g., "Paris, France").'),
  status: z.string().optional().describe('The real-time status of the flight (e.g., "On Time", "Delayed", "Landed"). Only for flights.'),
  travelerName: z.string().optional().describe("The name of the traveler for this specific booking, if available in the email."),
  details: z.object({
    confirmationNumber: z.string().optional().describe('Booking confirmation number.'),
    provider: z.string().optional().describe('The primary service provider (e.g., "Marriott", "Hertz", "Delta Airlines").'),
    bookingAgent: z.string().optional().describe('The booking agent or website if different from the provider (e.g., "Booking.com", "Expedia").'),
    from: z.string().optional().describe('For transportation, the departure location (e.g., "JFK Airport").'),
    to: z.string().optional().describe('For transportation, the arrival location (e.g., "CDG Airport").'),
    flightNumber: z.string().optional().describe('For flights, the flight number.'),
    airlineCode: z.string().optional().describe('The IATA airline code (e.g., "UA" for "United", "AF" for "Air France").'),
    phoneNumber: z.string().optional().describe('For lodging, the phone number of the hotel.'),
    boardingPassDataUri: z.string().optional().describe("If a boarding pass QR code image is present (either inline or as an attachment), its content as a data URI. Expected format: 'data:image/...;base64,...'"),
  }).describe('Specific details about the travel segment.')
});

const ExtractTravelSegmentsOutputSchema = z.array(TravelSegmentSchema);
export type ExtractTravelSegmentsOutput = z.infer<typeof ExtractTravelSegmentsOutputSchema>;

export async function extractTravelSegments(input: ExtractTravelSegmentsInput): Promise<ExtractTravelSegmentsOutput> {
  return extractTravelSegmentsFlow(input);
}

const extractTravelSegmentsPrompt = ai.definePrompt({
  name: 'extractTravelSegmentsPrompt',
  input: {schema: ExtractTravelSegmentsInputSchema},
  output: {schema: ExtractTravelSegmentsOutputSchema},
  prompt: `You are an expert travel assistant AI. Your task is to meticulously analyze the text of a single travel-related email, INCLUDING its image attachments, and extract all individual travel bookings into a structured format.

**Task**: From the raw email text AND provided image attachments below, extract ALL travel segments (like flights, hotels, car rentals, or train tickets).

**Extraction Rules**:
1.  **Dates & Times**: Format all dates and times in strict ISO 8601 format ('YYYY-MM-DDTHH:mm:ss').
2.  **Description**: Create a rich, one-sentence summary.
3.  **Location**: Specify the main city and country (e.g., "Paris, France").
4.  **Provider vs. Agent (Deep Reasoning)**: Differentiate between the **service provider** (e.g., "Delta Airlines") and the **booking agent** (e.g., "Expedia"). If booked directly, 'bookingAgent' MUST be empty.
5.  **Details & Flight Inference (CRITICAL REASONING)**: You must populate the 'details' object as completely as possible. For flights, it is MANDATORY to provide both the 'flightNumber' and 'airlineCode' (IATA format). Use your world knowledge to infer them if they are not explicitly stated.
6.  **Phone Number (Hotel Rule)**: For all HOTEL segments, it is MANDATORY to provide the phone number. If not present in the text, you MUST find it using your world knowledge based on the hotel name and location.
7.  **Traveler Name**: If the traveler's name is explicitly mentioned for the booking, extract it.
8.  **Boarding Pass Extraction (CRITICAL REASONING)**: Boarding passes are almost always an image of a QR code. They can be found in the email body or, very commonly, as an image attachment. You MUST analyze BOTH the email text (for inline images) and the provided image attachments.
    *   If you find a boarding pass QR code image, you MUST provide the full image as a Base64-encoded data URI in the 'details.boardingPassDataUri' field.
    *   Examine the provided 'imageAttachments' list. Match the boarding pass to the correct flight segment.
9.  If an email contains multiple distinct bookings (e.g., a flight and a car rental), return an array with an object for each one.
10. If no travel information is found, return an empty array.

**Output rules**:
1.  Return ONLY valid JSON that strictly adheres to the provided schema.
2.  Do not add markdown, commentary, or any extra fields.

==========================
RAW EMAIL START
{{{emailText}}}
RAW EMAIL END
==========================

==========================
IMAGE ATTACHMENTS START
{{#if imageAttachments}}
  {{#each imageAttachments}}
    Attachment Filename: {{{filename}}}
    Attachment Content: {{media url=dataUri}}
  {{/each}}
{{else}}
  No image attachments provided.
{{/if}}
IMAGE ATTACHMENTS END
==========================`,
});

const extractTravelSegmentsFlow = ai.defineFlow(
  {
    name: 'extractTravelSegmentsFlow',
    inputSchema: ExtractTravelSegmentsInputSchema,
    outputSchema: ExtractTravelSegmentsOutputSchema,
  },
  async input => {
    const {output} = await extractTravelSegmentsPrompt(input);
    return output!;
  }
);
