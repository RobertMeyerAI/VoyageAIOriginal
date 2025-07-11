
'use client';

import React, { useTransition } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { handleSync } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Cog, RefreshCw, Sparkles } from 'lucide-react';
import type { Trip } from '@/services/firestore';
import { useAuth } from '@/hooks/useAuth';

export default function TripHeader({ trip, isClient }: { trip: Trip, isClient: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { userEmail } = useAuth();

  const onSync = () => {
    if (!userEmail) {
      toast({
        variant: 'destructive',
        title: 'Not Logged In',
        description: 'You must be logged in to sync your trips.',
      });
      return;
    }
    startTransition(async () => {
      toast({ title: "Syncing with AI...", description: "Please wait while we update your trip details." });
      const result = await handleSync(userEmail);
      if (result.type === 'success') {
        toast({
            title: 'Sync Complete',
            description: result.message || 'Your trips have been updated.',
        });
        window.location.reload();
      } else if (result.type === 'error') {
          toast({
              variant: 'destructive',
              title: 'Scan Failed',
              description: result.message || 'An unknown error occurred during the scan.',
          });
      }
    });
  };

  return (
    <header className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-sm z-10 gap-4">
      <div className="flex items-center gap-4">
        <Link href="/" passHref>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold hidden sm:inline font-headline">VoyageAI</span>
        </div>
      </div>

      <div className="flex-grow flex justify-center px-4 sm:px-8">
        <div className="w-full max-w-md">
          {isClient ? (
            <div>
              <div className="flex justify-between items-center text-xs mb-1 text-muted-foreground">
                <span className="font-semibold">Planning Progress</span>
                <span className="font-semibold">{trip.planningProgress}%</span>
              </div>
              <Progress value={trip.planningProgress} className="w-full h-2" />
            </div>
          ) : (
            <div className="space-y-1">
              <Skeleton className="h-3 w-24 bg-muted" />
              <Skeleton className="h-2 w-full bg-muted" />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/settings" passHref>
          <Button variant="ghost" size="icon">
            <Cog className="h-6 w-6" />
          </Button>
        </Link>
        <Button variant="default" onClick={onSync} disabled={isPending}>
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          <span className="sr-only sm:not-sr-only sm:ml-2">Sync</span>
        </Button>
      </div>
    </header>
  );
}
