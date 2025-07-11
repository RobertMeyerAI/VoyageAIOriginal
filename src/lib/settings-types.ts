
export type AppSettings = {
    alerts: {
        checkInLeadTimeHours: number;
        lodgingGapHours: number;
    };
    appearance: {
        colors: {
            flight: string;
            hotel: string;
            train: string;
            car: string;
            delay: string;
            gap: string;
        };
    };
    data: {
        archiveDays: number;
    };
    profile: {
        travelerProfile: string;
    };
};

export const defaultSettings: AppSettings = {
    alerts: {
        checkInLeadTimeHours: 0,
        lodgingGapHours: 24,
    },
    appearance: {
        colors: {
            flight: '#38bdf8', // sky-400
            hotel: '#c084fc', // purple-400
            train: '#34d399', // emerald-400
            car: '#fb923c',   // orange-400
            delay: '#facc15', // yellow-400
            gap: '#facc15',   // yellow-400
        },
    },
    data: {
        archiveDays: 1,
    },
    profile: {
        travelerProfile: "I am a budget traveler, but I'm willing to spend a bit more if it saves a lot of time or is much more convenient. I prefer public transportation like subways, buses, or trains. Ride-sharing like Uber or Lyft is a good second choice. I want to avoid regular taxis unless there are no other options.",
    },
};
