
'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getPoiRecommendations } from '@/app/actions';
import type { Trip } from '@/services/firestore';
import type { AddPoiRecommendationsOutput } from '@/ai/flows/add-poi-recommendations';
import { Utensils, MountainSnow, Palmtree, Landmark, Building, ExternalLink, Star, Loader2, Wand2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAppSettings } from '@/hooks/useAppSettings';

const POI_ICONS: Record<string, React.ReactNode> = {
  restaurant: <Utensils className="h-5 w-5" />,
  activity: <MountainSnow className="h-5 w-5" />,
  sight: <Landmark className="h-5 w-5" />,
  default: <Palmtree className="h-5 w-5" />,
};

export default function Recommendations({ trip }: { trip: Trip }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [recommendations, setRecommendations] = useState<AddPoiRecommendationsOutput | null>(null);
  const [settings] = useAppSettings();

  const handleGetRecommendations = () => {
    startTransition(async () => {
      try {
        const travelerProfile = settings.profile.travelerProfile || "A traveler looking for interesting things to do.";
        const interests = "local culture, food, history"; // This could be made dynamic in the future

        const result = await getPoiRecommendations({
          destination: trip.primaryDestination,
          travelerProfile,
          tripType: 'sightseeing', // This could also be inferred from trip segments
          interests,
        });

        setRecommendations(result);
        toast({
          title: 'Recommendations Found!',
          description: result.progress,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
          variant: 'destructive',
          title: 'Failed to Get Recommendations',
          description: errorMessage,
        });
      }
    });
  };

  return (
    <Card className="bg-card shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-bold font-headline">AI Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!recommendations && !isPending && (
          <div className="text-center text-sm text-muted-foreground flex flex-col items-center gap-4">
            <p>Discover hidden gems for your trip to {trip.primaryDestination}.</p>
            <Button onClick={handleGetRecommendations}>
              <Wand2 className="mr-2 h-4 w-4" />
              Find things to do
            </Button>
          </div>
        )}
        {isPending && (
          <div className="space-y-3">
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Asking the AI for ideas...
            </div>
            <Skeleton className="h-20 w-full bg-muted" />
            <Skeleton className="h-20 w-full bg-muted" />
          </div>
        )}
        {recommendations && recommendations.recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.recommendations.map((item, index) => (
              <div key={index} className="p-3 rounded-lg border border-border/50 bg-secondary/30">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3">
                    <div className="text-primary mt-1">{POI_ICONS[item.type] || POI_ICONS.default}</div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(item.name + ' ' + item.location)}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <ExternalLink className="h-4 w-4"/>
                    </Button>
                  </a>
                </div>
                <div className="flex items-center gap-4 mt-2 pl-8 text-xs">
                  {item.rating && <Badge variant="outline"><Star className="h-3 w-3 mr-1 text-yellow-500" />{item.rating}</Badge>}
                  {item.priceRange && <Badge variant="outline">{item.priceRange}</Badge>}
                  {item.openingHours && <Badge variant="outline">{item.openingHours}</Badge>}
                </div>
              </div>
            ))}
             <Button onClick={handleGetRecommendations} disabled={isPending} variant="outline" className="w-full">
              <Wand2 className="mr-2 h-4 w-4" />
              Get More Ideas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
