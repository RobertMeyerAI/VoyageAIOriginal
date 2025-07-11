'use client'

import React, { useEffect, useState } from 'react';
import { getTripsForUser, type Trip } from '@/services/firestore';
import DashboardClient from './_components/DashboardClient';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, userEmail, loading: authLoading } = useAuth();
  const [initialTrips, setInitialTrips] = useState<Trip[]>([]);
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
          setInitialTrips(trips);
          setLoadingTrips(false);
        })
        .catch(error => {
          console.error("Failed to fetch trips for user:", error);
          setInitialTrips([]);
          setLoadingTrips(false);
        });
    } else {
      // User object exists but email is null for some reason, might be an anon user
      // or in a weird state. Treat as not fully logged in.
      setInitialTrips([]);
      setLoadingTrips(false);
    }
  }, [user, userEmail, authLoading, router]);

  if (authLoading || loadingTrips) {
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
