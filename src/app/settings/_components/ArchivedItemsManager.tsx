
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getArchivedTripsForUser, restoreTrip, restoreSegment, type Trip, type Segment } from '@/services/firestore';
import { useAuth } from '@/hooks/useAuth';
import { RotateCw, Briefcase, Plane } from 'lucide-react';

export default function ArchivedItemsManager() {
    const { toast } = useToast();
    const { userEmail } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [archivedTrips, setArchivedTrips] = useState<Trip[]>([]);
    const [isPending, startTransition] = useTransition();

    const fetchArchived = () => {
        if (!userEmail) return;
        setIsLoading(true);
        getArchivedTripsForUser(userEmail).then(trips => {
            setArchivedTrips(trips);
            setIsLoading(false);
        }).catch(err => {
            console.error(err);
            toast({ variant: 'destructive', title: "Error", description: "Could not load archived items." });
            setIsLoading(false);
        });
    };

    useEffect(() => {
        if (userEmail) {
            fetchArchived();
        } else {
            setIsLoading(false);
        }
    }, [userEmail]);

    const handleRestoreTrip = (tripId: string) => {
        if (!userEmail) return;
        startTransition(async () => {
            await restoreTrip(userEmail, tripId);
            toast({ title: "Trip Restored", description: "The trip is now back on your dashboard." });
            fetchArchived();
        });
    };

    const handleRestoreSegment = (tripId: string, segmentId: string) => {
        if (!userEmail) return;
        startTransition(async () => {
            await restoreSegment(userEmail, tripId, segmentId);
            toast({ title: "Segment Restored", description: "The segment is now back in its trip." });
            fetchArchived();
        });
    }

    const archivedSegmentsByTrip = archivedTrips.reduce((acc, trip) => {
        const segments = trip.segments.filter(s => s.isArchived);
        if (segments.length > 0) {
            acc[trip.id] = { tripName: trip.tripName, segments };
        }
        return acc;
    }, {} as Record<string, { tripName: string; segments: Segment[] }>);

    const fullTripsArchived = archivedTrips.filter(t => t.isArchived);

    return (
        <Card className="bg-white">
            <CardHeader>
                <CardTitle className="font-headline">Restore Archived Items</CardTitle>
                <CardDescription>Restore accidentally deleted trips or segments.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-24 w-full bg-black/10" /> : (
                    (fullTripsArchived.length === 0 && Object.keys(archivedSegmentsByTrip).length === 0) ? (
                        <p className="text-muted-foreground text-sm text-center py-4">No archived items found.</p>
                    ) : (
                        <Accordion type="multiple" className="space-y-4">
                            {fullTripsArchived.map(trip => (
                                <div key={trip.id} className="flex items-center justify-between p-3 bg-secondary/10 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <Briefcase className="h-5 w-5 text-[#794BC4]" />
                                        <div>
                                            <p className="font-semibold">{trip.tripName}</p>
                                            <p className="text-xs text-muted-foreground">Archived Trip</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => handleRestoreTrip(trip.id)} disabled={isPending}>
                                        <RotateCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                                        Restore
                                    </Button>
                                </div>
                            ))}
                            {Object.entries(archivedSegmentsByTrip).map(([tripId, { tripName, segments }]) => (
                                <AccordionItem key={tripId} value={tripId}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-3">
                                            <Briefcase className="h-5 w-5 text-[#794BC4]" />
                                            <div>
                                                <p className="font-semibold">{tripName}</p>
                                                <p className="text-xs text-muted-foreground text-left">{segments.length} archived segment(s)</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-2 pt-2">
                                        {segments.map(segment => (
                                            <div key={segment.id} className="flex items-center justify-between p-3 bg-secondary/10 rounded-md ml-8">
                                                <div className="flex items-center gap-3">
                                                    <Plane className="h-5 w-5 text-secondary-foreground" />
                                                    <div>
                                                        <p className="font-semibold">{segment.description}</p>
                                                        <p className="text-xs text-muted-foreground">Archived Segment</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => handleRestoreSegment(tripId, segment.id)} disabled={isPending}>
                                                    <RotateCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                                                    Restore
                                                </Button>
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )
                )}
            </CardContent>
        </Card>
    );
}
