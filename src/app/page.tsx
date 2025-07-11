
'use client'

import React, { useEffect, useState } from 'react';
import { getTripsForUser, type Trip } from '@/services/firestore';
import DashboardClient from './_components/DashboardClient';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const placeholderTrip: Trip = {
  id: 'placeholder-trip-1',
  tripName: 'Weekend Getaway to Paris',
  tripSummary: 'A quick weekend trip to explore the beautiful city of Paris, visiting iconic landmarks and enjoying French cuisine.',
  startDate: '2024-08-16',
  endDate: '2024-08-19',
  primaryDestination: 'Paris, France',
  planningProgress: 100,
  travelers: ['Test User'],
  alerts: [
    {
      id: 'alert-check-in-1',
      title: 'Check-in for your flight',
      description: 'Check-in opens for your flight to Paris in 24 hours.'
    }
  ],
  dismissedAlertIds: [],
  isArchived: false,
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  segments: [
    {
      id: 'placeholder-segment-1',
      type: 'FLIGHT',
      description: 'Flight from JFK to CDG',
      startDate: '2024-08-16T19:00:00Z',
      endDate: '2024-08-17T09:00:00Z',
      location: 'New York, USA',
      status: 'On Time',
      details: {
        confirmations: [{
          number: 'ABC1234',
          travelerName: 'Test User',
        }],
        provider: 'Air France',
        from: 'JFK - John F. Kennedy International Airport',
        to: 'CDG - Charles de Gaulle Airport',
        flightNumber: 'AF007',
        airlineCode: 'AF'
      },
      emailId: 'placeholder-email-1',
      isArchived: false,
    },
     {
      id: 'placeholder-segment-2',
      type: 'HOTEL',
      description: 'Hotel Le Grand, Paris',
      startDate: '2024-08-17T14:00:00Z',
      endDate: '2024-08-19T11:00:00Z',
      location: 'Paris, France',
      details: {
        confirmations: [{
          number: 'HOTEL5678',
          travelerName: 'Test User',
        }],
        provider: 'Hotel Le Grand',
        phoneNumber: '+33 1 23 45 67 89'
      },
      emailId: 'placeholder-email-2',
      isArchived: false,
    },
    {
      id: 'placeholder-segment-3',
      type: 'FLIGHT',
      description: 'Return flight from CDG to JFK',
      startDate: '2024-08-19T14:00:00Z',
      endDate: '2024-08-19T23:00:00Z',
      location: 'Paris, France',
      status: 'On Time',
      details: {
        confirmations: [{
          number: 'XYZ9876',
          travelerName: 'Test User',
        }],
        provider: 'Delta Airlines',
        from: 'CDG - Charles de Gaulle Airport',
        to: 'JFK - John F. Kennedy International Airport',
        flightNumber: 'DL263',
        airlineCode: 'DL'
      },
      emailId: 'placeholder-email-3',
      isArchived: false,
    }
  ]
};

export default function Home() {
  const { user, userEmail, loading: authLoading } = useAuth();
  const [initialTrips, setInitialTrips] = useState<Trip[]>([placeholderTrip]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) {
      return; 
    }
    if (!user) {
      router.push('/login');
      return;
    }
    if (userEmail) {
      getTripsForUser(userEmail)
        .then(trips => {
          // If real trips are found, use them. Otherwise, keep the placeholder.
          if (trips.length > 0) {
            setInitialTrips(trips);
          }
          setLoadingTrips(false);
        })
        .catch(error => {
          console.error("Failed to fetch trips for user:", error);
          // Keep placeholder on error
          setLoadingTrips(false);
        });
    } else {
      setLoadingTrips(false);
    }
  }, [user, userEmail, authLoading, router]);

  if (authLoading || (loadingTrips && initialTrips.length === 0)) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className='ml-2'>Loading your trips...</p>
        </div>
    );
  }
  
  return (
    <DashboardClient initialTrips={initialTrips} />
  );
}
