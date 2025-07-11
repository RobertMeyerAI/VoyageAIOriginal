
'use client';

import React, { useState, useEffect, ReactNode, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { format, formatDistanceToNow, differenceInHours, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Sparkles, CalendarDays, Info, Plane, BedDouble, TrainTrack, Car, MapPin, Hash, Clock, Loader2, Users, AlertCircle, X, TramFront, Footprints, Bus, Ship, DollarSign, ExternalLink, Lightbulb, AlertTriangle, Map, Briefcase, Phone, Cog, CheckCircle2, GripVertical, Trash2 } from 'lucide-react';
import { getTransportationOptions, type GetTransportationOptionsOutput } from '@/ai/flows/get-transportation-options';
import { updateFlightTimes } from '@/ai/flows/update-flight-times';
import FlightDetails from '@/components/ui/FlightDetails';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAppSettings } from '@/hooks/useAppSettings';
import type { AppSettings } from '@/lib/settings-types';
import { useToast } from '@/hooks/use-toast';
import { getTripForUser, updateTrip, archiveSegment, dismissAlert } from '@/services/firestore';
import type { Trip, Segment } from '@/services/firestore';
import TripHeader from './_components/Header';
import { useAuth } from '@/hooks/useAuth';
import Recommendations from './_components/Recommendations';

type TransportationOption = GetTransportationOptionsOutput[number];

const getSegmentStyle = (segmentType: string, settings: AppSettings) => {
    const colors = settings.appearance.colors;
    const styleMap: Record<string, { icon: ReactNode; color: string }> = {
        FLIGHT: { icon: <Plane className="h-5 w-5" />, color: colors.flight },
        HOTEL: { icon: <BedDouble className="h-5 w-5" />, color: colors.hotel },
        TRAIN: { icon: <TrainTrack className="h-5 w-5" />, color: colors.train },
        CAR: { icon: <Car className="h-5 w-5" />, color: colors.car },
        DEFAULT: { icon: <Briefcase className="h-5 w-5" />, color: '#94a3b8' }, // slate-400
    };
    return styleMap[segmentType] || styleMap.DEFAULT;
};

const formatTime = (dateStr: string) => format(new Date(dateStr), 'h:mm a');
const formatDate = (dateStr: string) => format(new Date(dateStr), 'E, MMM d');
const formatDateTime = (dateStr: string) => format(new Date(dateStr), 'E, MMM d, yyyy @ h:mm a');

const calculateGap = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = differenceInDays(endDate, startDate);
    const hours = differenceInHours(endDate, startDate) % 24;
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;

    return result.trim();
}

const transportIcons: Record<TransportationOption['type'], React.ReactNode> = {
    WALK: <Footprints className="h-6 w-6 text-[#794BC4]" />,
    SUBWAY: <TramFront className="h-6 w-6 text-[#794BC4]" />,
    BUS: <Bus className="h-6 w-6 text-[#794BC4]" />,
    TRAIN: <TrainTrack className="h-6 w-6 text-[#794BC4]" />,
    RIDESHARE: <Car className="h-6 w-6 text-[#794BC4]" />,
    TAXI: <Car className="h-6 w-6 text-[#794BC4]" />,
    FERRY: <Ship className="h-6 w-6 text-[#794BC4]" />,
};

export default function TripDetailsPage() {
    const [trip, setTrip] = useState<Trip | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);
    const [updatingSegments, setUpdatingSegments] = useState<Record<string, boolean>>({});
    const [transportationData, setTransportationData] = useState<{
        isLoading: boolean;
        options: GetTransportationOptionsOutput | null;
        endpoints: { origin: string; destination: string } | null;
    }>({ isLoading: false, options: null, endpoints: null });
    const [boardingPass, setBoardingPass] = useState<string | null>(null);
    const { toast } = useToast();
    const [deletingSegmentId, setDeletingSegmentId] = useState<string | null>(null);
    const { userEmail } = useAuth();
    const router = useRouter();
    
    const tripRef = useRef(trip);
    useEffect(() => {
        tripRef.current = trip;
    }, [trip]);

    const [settings] = useAppSettings();
    const params = useParams();
    const id = params.id as string;

    const activeSegments = React.useMemo(() => {
        if (!trip) return [];
        return trip.segments
            .filter(s => !s.isArchived)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [trip]);


    const { upcomingSegment, lastCompletedSegment } = React.useMemo(() => {
        if (!isClient || !trip) {
            return { upcomingSegment: undefined, lastCompletedSegment: undefined };
        }
        const now = new Date();
        const upcoming = activeSegments.find(s => new Date(s.startDate) > now);
        const lastCompleted = [...activeSegments].reverse().find(s => new Date(s.endDate) < now);
        return { upcomingSegment: upcoming, lastCompletedSegment: lastCompleted };
    }, [isClient, trip, activeSegments]);

    useEffect(() => {
        setIsClient(true);
        if (id && userEmail) {
            getTripForUser(userEmail, id).then(tripFromDB => {
                if (tripFromDB) {
                    setTrip(tripFromDB);
                }
                setLoading(false);
            }).catch(error => {
                console.error("Failed to fetch trip details:", error);
                toast({
                    variant: 'destructive',
                    title: 'Error Loading Trip',
                    description: 'Could not load trip details. The trip may no longer exist or there was a connection issue.'
                });
                setLoading(false);
            });
        } else if (!userEmail) {
            setLoading(false);
            router.push('/login');
        }
    }, [id, userEmail, toast, router]);

    const getSegmentStatus = (segment: Segment): { text: string; className: string } => {
        if (!isClient) {
            return { text: segment.status || 'Upcoming', className: 'bg-secondary text-secondary-foreground' };
        }
        const now = new Date();
        const startDate = new Date(segment.startDate);
        const endDate = new Date(segment.endDate);
        const status = segment.status?.toLowerCase() || '';
    
        if (status.includes('cancelled')) {
            return { text: segment.status!, className: 'bg-destructive/20 text-destructive border-destructive/30' };
        }
        if (status.includes('landed') || status.includes('arrived')) {
            return { text: segment.status!, className: 'bg-secondary text-secondary-foreground' };
        }
        if (endDate < now) {
            return { text: 'Completed', className: 'bg-secondary text-secondary-foreground' };
        }
        if (status.includes('on time')) {
            return { text: segment.status!, className: 'bg-green-500/20 text-green-400 border-green-500/30' };
        }
        if (status.includes('delayed')) {
            return { text: segment.status!, className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
        }
        if (startDate <= now && endDate >= now) {
            return { text: segment.status || 'In-Route', className: 'bg-primary/20 text-primary border-primary/30 animate-pulse' };
        }
    
        return { text: segment.status || 'Upcoming', className: 'bg-secondary text-secondary-foreground' };
    };

    const handleAccordionChange = (value: string) => {
        if (value) {
            setTimeout(() => {
                const item = document.querySelector(`[data-radix-accordion-item][data-value="${value}"]`);
                if (item) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 300);
        }
    };

    const handleShowBoardingPass = (dataUri: string) => {
        setBoardingPass(dataUri);
    };

    const handleTrackFlight = async (segmentId: string) => {
        if (!trip || !userEmail) return;
        const segment = trip.segments.find(s => s.id === segmentId);
        if (!segment || segment.type !== 'FLIGHT' || !segment.details.airlineCode || !segment.details.flightNumber) return;

        setUpdatingSegments(prev => ({ ...prev, [segmentId]: true }));

        try {
            const flightIdent = `${segment.details.airlineCode}${segment.details.flightNumber}`;
            const updatedInfo = await updateFlightTimes({
                ident: flightIdent,
                date: segment.startDate.split('T')[0],
            });

            const newTrip: Trip = JSON.parse(JSON.stringify(trip));
            const updatedSegment = newTrip.segments.find(s => s.id === segmentId);
            
            if (updatedSegment) {
                // @ts-ignore
                updatedSegment.originalStartDate = updatedSegment.originalStartDate || updatedSegment.startDate;
                // @ts-ignore
                updatedSegment.originalEndDate = updatedSegment.originalEndDate || updatedSegment.endDate;
                updatedSegment.status = updatedInfo.status || updatedSegment.status;
                updatedSegment.startDate = updatedInfo.updatedStartDate || updatedSegment.startDate;
                updatedSegment.endDate = updatedInfo.updatedEndDate || updatedSegment.endDate;
            }

            setTrip(newTrip);
            await updateTrip(userEmail, newTrip.id, { segments: newTrip.segments });

        } catch (error) {
            console.error("Failed to update flight status:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to update flight status." });
        } finally {
            setUpdatingSegments(prev => ({ ...prev, [segmentId]: false }));
        }
    };

    const handleGetTransport = async (origin: string, destination: string) => {
        setTransportationData({ isLoading: true, options: null, endpoints: { origin, destination } });
        try {
            const travelerProfile = settings.profile.travelerProfile;
            const options = await getTransportationOptions({ origin, destination, travelerProfile });
            setTransportationData({ isLoading: false, options, endpoints: { origin, destination } });
        } catch (error) {
            console.error("Failed to get transportation options:", error);
            setTransportationData({ isLoading: false, options: null, endpoints: { origin, destination } });
            toast({ variant: 'destructive', title: "Error", description: "Failed to get transportation options." });
        }
    };

    const handleSegmentDragEnd = async (result: DropResult) => {
        if (!result.destination || !trip || !userEmail) return;
    
        const reorderedActiveSegments = Array.from(activeSegments);
        const [movedItem] = reorderedActiveSegments.splice(result.source.index, 1);
        reorderedActiveSegments.splice(result.destination.index, 0, movedItem);

        const archivedSegments = trip.segments.filter(s => s.isArchived);
        const newSegments = [...reorderedActiveSegments, ...archivedSegments];

        const updatedTrip = { ...trip, segments: newSegments };
        setTrip(updatedTrip);
        await updateTrip(userEmail, trip.id, { segments: newSegments });
      };

    const handleArchiveSegment = (segmentId: string) => {
        if (!tripRef.current || !userEmail) return;
        
        setDeletingSegmentId(segmentId);
        setTimeout(async () => {
            if (!tripRef.current || !userEmail) return;
            await archiveSegment(userEmail, tripRef.current.id, segmentId);
            
            const updatedTrip = { ...tripRef.current };
            const segmentToUpdate = updatedTrip.segments.find(s => s.id === segmentId);
            if (segmentToUpdate) {
                segmentToUpdate.isArchived = true;
            }
            setTrip(updatedTrip);

            toast({
                title: 'Segment Archived',
                description: 'The travel segment has been moved to the archive.',
            });
            setDeletingSegmentId(null);
        }, 300);
    };

    const handleDismissAlert = async (alertId: string) => {
        if (!tripRef.current || !userEmail) return;
        
        const currentTrip = tripRef.current;
        const newDismissedAlertIds = [...(currentTrip.dismissedAlertIds || []), alertId];
      
        const updatedTrip = { ...currentTrip, dismissedAlertIds: newDismissedAlertIds };
        setTrip(updatedTrip);
    
        await dismissAlert(userEmail, currentTrip.id, alertId);
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F4F2F9] text-black">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!trip) {
        return (
            <div className="flex flex-col min-h-screen w-full bg-[#F4F2F9] text-black">
                 <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-[#F4F2F9] z-10">
                    <div className="flex items-center gap-4">
                        <Link href="/" passHref>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div className="flex items-center gap-3">
                            <Sparkles className="h-7 w-7 text-[#794BC4]" />
                            <span className="text-xl font-bold font-headline">TripSpark</span>
                        </div>
                    </div>
                    <Link href="/settings" passHref>
                        <Button variant="ghost" size="icon">
                            <Cog className="h-6 w-6" />
                        </Button>
                    </Link>
                </header>
                <main className="flex-1 p-8 text-center">
                    <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h1 className="text-2xl font-bold font-headline">Trip not found</h1>
                    <p className="text-muted-foreground mt-2">Could not find the details for this trip. It might have been removed.</p>
                    <Link href="/" passHref>
                        <Button variant="link" className="mt-4 text-[#794BC4]">Go back to all trips</Button>
                    </Link>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen w-full bg-[#F4F2F9] text-black font-body">
            <TripHeader trip={trip} isClient={isClient} />

            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-4">
                            <h1 className="text-2xl md:text-3xl font-bold text-foreground font-headline">{trip.tripName} Timeline</h1>
                            {isClient ? (
                                <DragDropContext onDragEnd={handleSegmentDragEnd}>
                                <Droppable droppableId="segments">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef}>
                                    <Accordion type="single" collapsible className="w-full space-y-4" onValueChange={handleAccordionChange}>
                                        {activeSegments.map((segment, index) => {
                                            const nextSegment = activeSegments[index + 1];
                                            const segmentStatus = getSegmentStatus(segment);
                                            const accordionValue = `segment-${segment.id}`;
                                            const segmentStyle = getSegmentStyle(segment.type, settings);

                                            return (
                                            <Draggable key={segment.id} draggableId={segment.id} index={index}>
                                            {(provided) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    data-radix-accordion-item
                                                    data-value={accordionValue}
                                                    className={cn("space-y-4 transition-opacity duration-300", {
                                                        'opacity-0': deletingSegmentId === segment.id,
                                                    })}
                                                >
                                                {segment.type === 'FLIGHT' ? (
                                                    <FlightDetails 
                                                        value={accordionValue}
                                                        segment={segment as Segment & { originalStartDate?: string, originalEndDate?: string}} 
                                                        trip={trip} 
                                                        onTrackFlight={() => handleTrackFlight(segment.id)}
                                                        isUpdating={!!updatingSegments[segment.id]}
                                                        originalStatus={segmentStatus} 
                                                        nextSegment={nextSegment}
                                                        onGetTransport={handleGetTransport}
                                                        onShowBoardingPass={handleShowBoardingPass}
                                                        settings={settings}
                                                        dragHandleProps={provided.dragHandleProps}
                                                        onDelete={() => handleArchiveSegment(segment.id)}
                                                    />
                                                ) : (
                                                    <AccordionItem value={accordionValue} className="border-none">
                                                        <Card className="bg-white shadow-lg border-border/50 overflow-hidden transition-all duration-300 border-l-4" style={{ borderLeftColor: segmentStyle.color }}>
                                                            <AccordionTrigger className="p-4 hover:no-underline focus:ring-1 focus:ring-primary/50 rounded-lg group">
                                                                <div className="flex items-center justify-between w-full">
                                                                    <div className="flex items-center gap-4">
                                                                        <div {...provided.dragHandleProps} className="p-1 cursor-grab text-muted-foreground hover:text-foreground">
                                                                            <GripVertical className="h-5 w-5"/>
                                                                        </div>
                                                                        <div style={{ color: segmentStyle.color }}>{segmentStyle.icon}</div>
                                                                        <div>
                                                                            <p className="font-semibold text-lg text-left">{segment.details.provider || segment.type}</p>
                                                                            <p className="text-sm text-muted-foreground text-left">{formatTime(segment.startDate)} → {formatTime(segment.endDate)}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex flex-col items-end">
                                                                            <p className="text-sm text-muted-foreground">{formatDate(segment.startDate)}</p>
                                                                            <Badge variant="outline" className={cn("mt-1 text-xs", segmentStatus.className)}>{segmentStatus.text}</Badge>
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                            onClick={(e) => { e.stopPropagation(); handleArchiveSegment(segment.id); }}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </AccordionTrigger>
                                                            <AccordionContent className="px-4 pb-4">
                                                                <div className="border-t border-border/50 mt-2 pt-4 space-y-4 text-sm">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                                                        {segment.type === 'HOTEL' && <>
                                                                            <div className="flex items-start gap-3"><CalendarDays className="h-4 w-4 mt-0.5 text-[#794BC4]" /><div><span className="font-semibold">Check-in</span><p className="text-muted-foreground">{formatDateTime(segment.startDate)}</p></div></div>
                                                                            <div className="flex items-start gap-3"><CalendarDays className="h-4 w-4 mt-0.5 text-[#794BC4]" /><div><span className="font-semibold">Check-out</span><p className="text-muted-foreground">{formatDateTime(segment.endDate)}</p></div></div>
                                                                        </>}
                                                                        {segment.type === 'CAR' && <>
                                                                            <div className="flex items-start gap-3"><Clock className="h-4 w-4 mt-0.5 text-[#794BC4]" /><div><span className="font-semibold">Pickup</span><p className="text-muted-foreground">{formatDateTime(segment.startDate)}</p></div></div>
                                                                            <div className="flex items-start gap-3"><Clock className="h-4 w-4 mt-0.5 text-[#794BC4]" /><div><span className="font-semibold">Drop-off</span><p className="text-muted-foreground">{formatDateTime(segment.endDate)}</p></div></div>
                                                                        </>}
                                                                        {segment.details.confirmations && segment.details.confirmations.length > 0 ? (
                                                                            segment.details.confirmations.map((conf, idx) => (
                                                                                <div key={idx} className="flex items-start gap-3">
                                                                                    <Hash className="h-4 w-4 mt-0.5 text-[#794BC4]" />
                                                                                    <div>
                                                                                        <span className="font-semibold">Confirmation #</span>
                                                                                        {conf.travelerName && <span className="text-muted-foreground text-xs"> ({conf.travelerName})</span>}
                                                                                        <p className="text-muted-foreground">{conf.number || 'N/A'}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <div className="flex items-start gap-3"><Hash className="h-4 w-4 mt-0.5 text-[#794BC4]" /><div><span className="font-semibold">Confirmation #</span><p className="text-muted-foreground">N/A</p></div></div>
                                                                        )}
                                                                        {segment.details.bookingAgent && (
                                                                            <div className="flex items-start gap-3"><Briefcase className="h-4 w-4 mt-0.5 text-[#794BC4]" /><div><span className="font-semibold">Booked via</span><p className="text-muted-foreground">{segment.details.bookingAgent}</p></div></div>
                                                                        )}
                                                                        {segment.details.phoneNumber && (
                                                                            <div className="flex items-start gap-3"><Phone className="h-4 w-4 mt-0.5 text-[#794BC4]" /><div><span className="font-semibold">Phone</span><p className="text-muted-foreground">{segment.details.phoneNumber}</p></div></div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {nextSegment && (
                                                                            <Button onClick={() => handleGetTransport(segment.location, nextSegment.details.from || nextSegment.location)} variant="outline" size="sm">
                                                                                <TramFront className="mr-2 h-4 w-4"/>
                                                                                Find Onward Travel
                                                                            </Button>
                                                                        )}
                                                                        {segment.type === 'HOTEL' && segment.details.provider && (
                                                                            <a 
                                                                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(segment.details.provider + ', ' + segment.location)}`} 
                                                                                target="_blank" 
                                                                                rel="noopener noreferrer"
                                                                            >
                                                                                <Button variant="outline" size="sm">
                                                                                    <Map className="mr-2 h-4 w-4"/>
                                                                                    Get There
                                                                                </Button>
                                                                            </a>
                                                                        )}
                                                                        {segment.type === 'HOTEL' && segment.details.phoneNumber && (
                                                                            <a href={`tel:${segment.details.phoneNumber}`}>
                                                                                <Button variant="outline" size="sm">
                                                                                    <Phone className="mr-2 h-4 w-4" />
                                                                                    Call Lodging
                                                                                </Button>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </AccordionContent>
                                                        </Card>
                                                    </AccordionItem>
                                                )}

                                                {nextSegment && (
                                                    <div className="text-center text-xs py-1 flex items-center gap-2 justify-center" style={{color: settings.appearance.colors.gap}}>
                                                        <div className="border-t border-dashed w-full" style={{borderColor: settings.appearance.colors.gap}}></div>
                                                        <span className="shrink-0">
                                                            -- {calculateGap(segment.endDate, nextSegment.startDate)} gap in {nextSegment.location.split(',')[0]} --
                                                        </span>
                                                        <div className="border-t border-dashed w-full" style={{borderColor: settings.appearance.colors.gap}}></div>
                                                    </div>
                                                )}
                                                </div>
                                            )}
                                            </Draggable>
                                        )})}
                                        {provided.placeholder}
                                    </Accordion>
                                    
                                    </div>
                                )}
                                </Droppable>
                                </DragDropContext>

                            ) : (
                                <div className="space-y-4">
                                    <Skeleton className="h-28 w-full bg-black/10" />
                                    <Skeleton className="h-28 w-full bg-black/10" />
                                    <Skeleton className="h-28 w-full bg-black/10" />
                                </div>
                            )}
                        </div>

                        <aside className="lg:col-span-1 space-y-8 sticky top-24 self-start">
                            <Card className="bg-white shadow-lg border-border/50">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold font-headline">Trip Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    {isClient ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <MapPin className="h-4 w-4 text-[#794BC4]" />
                                                <span>You are currently in <span className="font-semibold">{lastCompletedSegment?.location || trip.primaryDestination}</span>.</span>
                                            </div>
                                            {upcomingSegment ? (
                                                <div className="flex items-center gap-3">
                                                    <Clock className="h-4 w-4 text-[#794BC4]" />
                                                    <span>Next up: {upcomingSegment.details.provider} in <span className="font-semibold">{formatDistanceToNow(new Date(upcomingSegment.startDate))}</span>.</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <Clock className="h-4 w-4 text-[#794BC4]" />
                                                    <span>No upcoming plans for this trip.</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <Skeleton className="h-5 w-3/4 bg-black/10" />
                                            <Skeleton className="h-5 w-full bg-black/10" />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            
                             <Card className="bg-white shadow-lg border-border/50">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold font-headline">Trip Alerts</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(trip.alerts && trip.alerts.filter(a => !(trip.dismissedAlertIds || []).includes(a.id)).length > 0) ? (
                                        trip.alerts.filter(a => !(trip.dismissedAlertIds || []).includes(a.id)).map((alert, index) => {
                                            const isCancellation = alert.title.toLowerCase().includes('cancel');
                                            const isDelay = alert.title.toLowerCase().includes('delay');
                                            
                                            return (
                                                <div key={alert.id} className="relative group/alert">
                                                    <Alert variant={isCancellation ? 'destructive' : 'caution'}>
                                                        <AlertTriangle className="h-4 w-4" />
                                                        <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                                                        <AlertDescription className="opacity-80 text-xs">
                                                            {alert.description}
                                                        </AlertDescription>
                                                    </Alert>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-6 w-6 text-muted-foreground opacity-0 group-hover/alert:opacity-100 transition-opacity"
                                                        onClick={() => handleDismissAlert(alert.id)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">No active alerts for this trip.</p>
                                    )}
                                </CardContent>
                            </Card>
                            
                            <Recommendations trip={trip} />

                        </aside>
                    </div>
                </div>
            </main>
            
            <Dialog open={!!boardingPass} onOpenChange={(isOpen) => !isOpen && setBoardingPass(null)}>
                <DialogContent className="max-w-md p-4 bg-white text-black">
                    <DialogHeader>
                        <DialogTitle>Boarding Pass</DialogTitle>
                        <DialogDescription>
                            Scan this QR code at the gate.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center items-center p-4">
                    {boardingPass && (
                        <Image
                            src={boardingPass}
                            alt="Boarding Pass QR Code"
                            width={350}
                            height={350}
                            className="rounded-lg"
                            unoptimized
                        />
                    )}
                    </div>
                </DialogContent>
            </Dialog>
            
            <Dialog open={!!transportationData.endpoints} onOpenChange={(isOpen) => !isOpen && setTransportationData({ isLoading: false, options: null, endpoints: null })}>
                <DialogContent className="max-w-2xl bg-white text-black">
                    <DialogHeader>
                        <DialogTitle className="font-headline">Onward Transportation Options</DialogTitle>
                        {transportationData.endpoints && (
                            <DialogDescription>
                                From: {transportationData.endpoints.origin}<br />
                                To: {transportationData.endpoints.destination}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {transportationData.isLoading && (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full bg-black/10" />
                                <Skeleton className="h-24 w-full bg-black/10" />
                                <Skeleton className="h-24 w-full bg-black/10" />
                            </div>
                        )}
                        {!transportationData.isLoading && transportationData.options && transportationData.options.length > 0 && transportationData.options.map((opt, i) => (
                            <Card key={i} className="bg-secondary/10 border-border/70">
                                <CardContent className="p-4 flex items-start gap-4">
                                    <div className="pt-1">{transportIcons[opt.type]}</div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-base text-foreground">{opt.name}</p>
                                            {opt.bookingLink && (
                                                <a href={opt.bookingLink} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="ghost" size="sm">
                                                        Book <ExternalLink className="ml-2 h-3 w-3" />
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
                                        <div className="flex items-center gap-6 mt-3 text-xs">
                                            <div className="flex items-center gap-2"><DollarSign className="h-3 w-3" /> Cost: <span className="font-semibold">{opt.estimatedCost}</span></div>
                                            <div className="flex items-center gap-2"><Clock className="h-3 w-3" /> Time: <span className="font-semibold">{opt.estimatedDuration}</span></div>
                                        </div>
                                        {opt.proTip && (
                                            <Alert className="mt-3 bg-background/5 text-xs py-2 px-3 border-yellow-500/20 text-yellow-800">
                                                <Lightbulb className="h-4 w-4 text-yellow-600" />
                                                <AlertDescription>{opt.proTip}</AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                         {!transportationData.isLoading && (!transportationData.options || transportationData.options.length === 0) && (
                            <div className="text-center text-muted-foreground py-8">
                                <Info className="mx-auto h-8 w-8 mb-2" />
                                <p>Could not find any transportation options.</p>
                                <p className="text-xs">The AI might be offline or no routes were found.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
