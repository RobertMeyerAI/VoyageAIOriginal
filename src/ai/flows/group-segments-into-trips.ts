
'use server';
/**
 * @fileOverview Groups individual travel segments into coherent trips.
 *
 * - groupSegmentsIntoTrips - A function that groups travel segments into trips.
 * - GroupSegmentsIntoTripsInput - The input type for the function.
 * - GroupSegmentsIntoTripsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for input segments. Can be new (with 1 confirmation) or existing (with multiple).
const InputTravelSegmentSchema = z.object({
  id: z.string().describe('A unique identifier for the segment.'),
  type: z.enum(['FLIGHT', 'HOTEL', 'TRAIN', 'CAR']).describe('The type of the travel segment.'),
  description: z.string().describe('A detailed summary of the segment.'),
  startDate: z.string().describe('The start date of this segment in YYYY-MM-DDTHH:mm:ss format.'),
  endDate: z.string().describe('The end date of this segment in YYYY-MM-DDTHH:mm:ss format.'),
  location: z.string().describe('The primary city or location for this segment.'),
  status: z.string().optional().describe('The real-time status of the flight (e.g., "On Time", "Delayed", "Landed"). Only for flights.'),
  details: z.object({
    confirmations: z.array(z.object({
        number: z.string().optional().describe('Booking confirmation number.'),
        travelerName: z.string().optional().describe('The name of the traveler associated with this confirmation.'),
        boardingPassDataUri: z.string().optional().describe('Boarding pass QR code as a data URI.'),
    })).describe('List of confirmation numbers and associated traveler names for this segment. New, unmerged segments will have a single entry in this array.'),
    provider: z.string().optional().describe('The service provider.'),
    bookingAgent: z.string().optional().describe('The booking agent or website if different from the provider.'),
    from: z.string().optional().describe('Departure location.'),
    to: z.string().optional().describe('Arrival location.'),
    flightNumber: z.string().optional().describe('Flight number.'),
    airlineCode: z.string().optional().describe('The IATA airline code (e.g., "UA").'),
    phoneNumber: z.string().optional().describe('For lodging, the phone number of the hotel.'),
  }),
  emailId: z.string().describe('The ID of the email this segment was extracted from.'),
  tripId: z.string().optional().describe('The ID of the trip this segment currently belongs to, if any.'),
  isArchived: z.boolean().optional().describe('Whether the user has archived this segment.'),
});


const GroupSegmentsIntoTripsInputSchema = z.object({
  segments: z.array(InputTravelSegmentSchema).describe('A flat list of all available travel segments, both new and from existing trips. Segments from existing trips will have a tripId and may already be merged (i.e., have multiple confirmations).'),
  lodgingGapHours: z.number().optional().describe('The number of hours that constitutes a "lodging gap". Defaults to 24.'),
  checkInLeadTimeHours: z.number().optional().describe('How many hours before a flight to create a check-in reminder. Set to 0 to disable.'),
  currentDate: z.string().describe('The current date and time in ISO 8601 format. This is used for time-sensitive alert generation.'),
});
export type GroupSegmentsIntoTripsInput = z.infer<typeof GroupSegmentsIntoTripsInputSchema>;

// Schema for output segments (merged) that will be part of a trip
const MergedTravelSegmentSchema = z.object({
    id: z.string().describe('A unique identifier for the segment. PRESERVE this from the input segment(s).'),
    type: z.enum(['FLIGHT', 'HOTEL', 'TRAIN', 'CAR']).describe('The type of the travel segment.'),
    description: z.string().describe('A detailed summary of the segment.'),
    startDate: z.string().describe('The start date of this segment in YYYY-MM-DDTHH:mm:ss format.'),
    endDate: z.string().describe('The end date of this segment in YYYY-MM-DDTHH:mm:ss format.'),
    location: z.string().describe('The primary city or location for this segment.'),
    status: z.string().optional().describe('The real-time status of the flight (e.g., "On Time", "Delayed", "Landed"). Only for flights.'),
    details: z.object({
      confirmations: z.array(z.object({
          number: z.string().optional().describe('Booking confirmation number.'),
          travelerName: z.string().optional().describe('The name of the traveler associated with this confirmation.'),
          boardingPassDataUri: z.string().optional().describe('Boarding pass QR code as a data URI.'),
      })).describe('List of confirmation numbers and associated traveler names for this segment.'),
      provider: z.string().optional().describe('The service provider.'),
      bookingAgent: z.string().optional().describe('The booking agent or website if different from the provider (e.g., "Booking.com", "Expedia").'),
      from: z.string().optional().describe('Departure location.'),
      to: z.string().optional().describe('Arrival location.'),
      flightNumber: z.string().optional().describe('Flight number.'),
      airlineCode: z.string().optional().describe('The IATA airline code (e.g., "UA").'),
      phoneNumber: z.string().optional().describe('For lodging, the phone number of the hotel.'),
    }),
    emailId: z.string().describe('The ID of the email this segment was extracted from. If merged, use the ID from the first segment.'),
    isArchived: z.boolean().optional().describe('Whether the user has archived this segment. Preserve this value.'),
  });
  
const AlertSchema = z.object({
    id: z.string().describe("A unique, deterministic ID for this alert. For lodging gaps, this should be a combination of the two segment identifiers. For check-in reminders, it should be based on the flight's identifier."),
    title: z.string(),
    description: z.string(),
});

const TripSchema = z.object({
    id: z.string().describe("A unique identifier for the trip. You must follow the ID Management Rules to assign this. E.g., 'trip-to-paris-a1b2c3'."),
    tripName: z.string().describe('A descriptive and human-friendly name for the trip (e.g., "European Adventure" or "Weekend in New York").'),
    icon: z.string().optional().describe('A simple, single-color SVG string icon representing the primary destination of the trip. The SVG should be small (e.g., viewBox="0 0 24 24"), use `currentColor` for the fill, and have no fixed width or height attributes.'),
    tripSummary: z.string().describe('A one-paragraph summary of the entire trip, highlighting the key destinations and activities.'),
    startDate: z.string().describe('The overall start date for the entire trip (YYYY-MM-DD).'),
    endDate: z.string().describe('The overall end date for the entire trip (YYYY-MM-DD).'),
    primaryDestination: z.string().describe('The primary destination city of the trip (e.g., "Paris").'),
    planningProgress: z.number().describe('An estimated percentage (0-100) of how complete the trip planning is. 100% means all travel and lodging is booked with no gaps.'),
    travelers: z.array(z.string()).optional().describe('The names of the travelers on the trip. Extract from the email if available.'),
    alerts: z.array(AlertSchema).describe('A list of important alerts or reminders for the trip, such as check-in reminders or lodging gaps.'),
    dismissedAlertIds: z.array(z.string()).optional().describe('A list of alert IDs that the user has dismissed. This field should be preserved from the original trip data if it exists.'),
    isArchived: z.boolean().optional().describe('Whether the user has archived this trip.'),
    segments: z.array(MergedTravelSegmentSchema).describe('The list of travel segments that belong to this trip, ordered chronologically.'),
});

const GroupSegmentsIntoTripsOutputSchema = z.array(TripSchema);
export type GroupSegmentsIntoTripsOutput = z.infer<typeof GroupSegmentsIntoTripsOutputSchema>;

export async function groupSegmentsIntoTrips(input: GroupSegmentsIntoTripsInput): Promise<GroupSegmentsIntoTripsOutput> {
  if (input.segments.length === 0) {
    return [];
  }
  return groupSegmentsIntoTripsFlow(input);
}

const groupSegmentsIntoTripsPrompt = ai.definePrompt({
  name: 'groupSegmentsIntoTripsPrompt',
  input: {schema: GroupSegmentsIntoTripsInputSchema},
  output: {schema: GroupSegmentsIntoTripsOutputSchema},
  prompt: `You are an expert travel agent AI. Your primary task is to consolidate a list of individual travel segments into a de-duplicated, coherent list of trips. You must intelligently merge new information with existing trip data by using the 'tripId' provided on some segments.

**Input**:
You will receive a flat list of travel segments. 
- Segments with a 'tripId' belong to a trip that already exists. These may already be "merged" (i.e., have multiple confirmations).
- Segments without a 'tripId' are brand new. These will always have a single entry in their 'confirmations' array.
- Segments with 'isArchived: true' have been deleted by the user and should be IGNORED for trip grouping and alert generation, but MUST be included in the final trip's segment list with their 'isArchived' flag preserved.

**CRITICAL ID MANAGEMENT RULES**:
You MUST assign a unique 'id' to every trip in your output.
*   **ID Preservation**: When you group segments into a trip, examine the 'tripId's of its contents. If the segments in the trip predominantly come from a single original 'tripId', you MUST reuse that original ID for the output trip's 'id'. This is the most common case.
*   **ID for Merged Trips**: If a trip is the result of merging segments from multiple different 'tripId's (e.g., a new flight connects a trip in Paris and a trip in Rome), you MUST choose the ID of the trip that contributes the most segments (or the one that starts earlier) and use it for the final merged trip's 'id'.
*   **ID for New Trips**: If a trip consists entirely of new segments that had no 'tripId', you MUST generate a new, unique ID for it. The ID MUST be a URL-friendly slug based on the trip name, with a 6-character random alphanumeric suffix to ensure uniqueness. For example: 'weekend-in-new-york-f3a9b1'.
*   **Segment ID Preservation**: The unique 'id' of each segment MUST be preserved from input to output. When merging segments, the resulting segment should retain the ID of the primary segment.

**CRITICAL SEGMENT MERGING LOGIC**:
*   **Identify Duplicates for Merging**: A segment is a candidate for merging with another if they are for the same event. This means they share the same 'type', 'provider', 'startDate', 'endDate', and locations ('from', 'to', 'location'). They will likely have different confirmation details.
*   **Hotel Merging Exception**: For HOTEL segments specifically, if two bookings are for the same 'provider' and 'location' with the same 'startDate' and 'endDate' (or dates that directly overlap), you MUST merge them. This often happens when different travelers book separate rooms for the same stay. The goal is to represent one hotel stay with multiple rooms/confirmations, not two separate stays.
*   **Merge Duplicates**: When you find such duplicate segments (often a new segment matching an existing one), merge them into a single segment object. The new, merged segment's 'details.confirmations' array MUST contain the confirmation details from ALL original duplicate segments.
*   **Result of Merging**: After this pass, you will have a list of unique, potentially merged segments. Proceed to group these segments into trips.

**Core Logic for Trip Grouping:**
*   **Chronological & Geographical Proximity:** Group ACTIVE (not archived) segments that are close in time and location. A flight to a city followed by a hotel booking in the same city is part of the same trip.
*   **Logical Gaps:** If there's a large time gap (e.g., several weeks) or a significant geographical jump between active segments that doesn't seem to be part of a single journey, treat them as separate trips.
*   **Trip Naming & Summary:** Create a concise 'tripName' and a one-paragraph 'tripSummary' for each trip.
*   **Icon Generation (MANDATORY)**: For each trip, you MUST create a creative and culturally relevant SVG icon representing the trip's 'primaryDestination'. This should be a simple, single-color line drawing. The SVG string MUST use 'viewBox="0 0 24 24"', have 'fill="none"', 'stroke="currentColor"', 'stroke-width="2"', and no 'width' or 'height' attributes. Example for Paris: '<svg ...><path d="M12 2L2 22h20L12 2zm0 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>'. Example for Tokyo: '<svg ...><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>'. Be creative and specific.
*   **Date Calculation (MANDATORY)**: A trip's overall 'startDate' MUST be the absolute earliest 'startDate' from all of its ACTIVE (non-archived) segments. The trip's 'endDate' MUST be the absolute latest 'endDate' from all of its ACTIVE segments. You MUST examine all segments in the trip to determine these two dates. The output format MUST be YYYY-MM-DD.
*   **Segment Ordering**: The 'segments' within each trip must be sorted chronologically by 'startDate'.
*   **Completeness:** Ensure every input segment is assigned to exactly one trip.
*   **Planning Progress (MANDATORY)**: Calculate a 'planningProgress' percentage (0-100) based on whether the trip has round-trip transport and lodging with no gaps among its ACTIVE segments.
*   **Alerts & Travelers**:
    *   **Travelers**: Collect all unique traveler names into the trip-level 'travelers' array.
    *   **Lodging Gaps**: Create alerts for gaps between ACTIVE segments longer than **{{{lodgingGapHours}}} hours**. The alert ID must be a deterministic combination of the two segments, like \`gap-\${segment1.id}-\${segment2.id}\`.
    *   **Check-in Reminders**: Use the 'currentDate' ({{{currentDate}}}) to generate check-in reminders for future ACTIVE flights that are within **{{{checkInLeadTimeHours}}} hours** of departure. If 'checkInLeadTimeHours' is set to 0, you MUST NOT generate any check-in reminders. The alert ID must be deterministic, like \`checkin-\${flightSegment.id}\`. Do not create reminders for past flights.
*   **Dismissed Alerts**: If an input segment's original trip data contained a 'dismissedAlertIds' field, you MUST preserve this list in the final trip object. This allows user preferences to persist.
*   **Archive Status**: For any trip that is updated, you MUST set its \`isArchived\` property to \`false\`. New trips should also have this property set to \`false\`.

**Input Data:**
You will receive a JSON object containing a list of all available travel segments. Here is the data:
{{{json segments}}}

**Output Format:**
Please provide your response as a valid JSON array of trip objects, strictly adhering to the output schema. Do not include any other text, markdown, or commentary. Each trip object in the array MUST have an 'id' field that follows the ID Management Rules.
`,
});

const groupSegmentsIntoTripsFlow = ai.defineFlow(
  {
    name: 'groupSegmentsIntoTripsFlow',
    inputSchema: GroupSegmentsIntoTripsInputSchema,
    outputSchema: GroupSegmentsIntoTripsOutputSchema,
  },
  async (input) => {
    const {output} = await groupSegmentsIntoTripsPrompt({
      segments: input.segments,
      lodgingGapHours: input.lodgingGapHours ?? 24,
      checkInLeadTimeHours: input.checkInLeadTimeHours ?? 0,
      currentDate: input.currentDate,
    });
    // Post-processing to fix potential AI errors
    const processedOutput = output?.map(trip => ({
      ...trip,
      isArchived: trip.isArchived ?? false,
      travelers: trip.travelers || [],
      alerts: trip.alerts || [],
      dismissedAlertIds: trip.dismissedAlertIds || [],
      segments: trip.segments.map(segment => ({...segment, isArchived: segment.isArchived ?? false}))
    }));
    return processedOutput || [];
  }
);
