
'use client';

import React, { ReactNode, useEffect, useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { archiveTrip } from '@/services/firestore';
import { handleSync, type ScanResult } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, RefreshCw, Sparkles, CalendarDays, CalendarOff, Users, Hash, MapPin, Clock, Plane, Briefcase, Cog, Trash2, GripVertical, LogOut, ChevronUp, ChevronsUp, ChevronsDown } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { updateTrip } from '@/services/firestore';
import type { Trip, Alert as TripAlert } from '@/services/firestore';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const initialScanState: ScanResult = {
  type: 'idle',
  trips: [],
  message: null,
  logs: [],
};

const StatItem = ({ icon, label, value }: { icon: ReactNode, label: string, value: string | number }) => (
    <div className="flex items-center gap-2">
        <div className="text-primary">{icon}</div>
        <div className="text-sm">
            <div className="text-muted-foreground">{label}</div>
            <div className="font-semibold text-foreground">{value}</div>
        </div>
    </div>
);

const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; 
    }
    return Math.abs(hash);
};

const tripColors = [
    '#794BC4',
    '#3B82F6', 
    '#c084fc', 
    '#f472b6', 
    '#fb923c', 
    '#34d399', 
    '#a3e635', 
];
  
const getTripColor = (tripId: string) => {
    const hash = simpleHash(tripId);
    return tripColors[hash % tripColors.length];
};

export default function DashboardClient({ initialTrips }: { initialTrips: Trip[] }) {
  const router = useRouter();
  const { user, userEmail, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [displayedTrips, setDisplayedTrips] = useState<Trip[]>([]);
  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ScanResult>(initialScanState);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  
  const tripsRef = useRef(displayedTrips);
  useEffect(() => {
    tripsRef.current = displayedTrips;
  }, [displayedTrips]);

  useEffect(() => {
    setIsClient(true);
    if (!authLoading && !user) {
        router.push('/login');
    }
    if (user) {
      setDisplayedTrips(initialTrips.filter(trip => !trip.isArchived));
    }
  }, [initialTrips, user, authLoading, router]);

  const handleLogout = async () => {
    if (!auth) {
      console.error("Auth is null, cannot sign out.");
      return;
    }
    await signOut(auth);
    router.push('/login');
  };

  const handleArchiveTrip = (tripId: string) => {
    if (!userEmail) return;
    setDeletingTripId(tripId);
    startTransition(async () => {
      await archiveTrip(userEmail, tripId);
      const updatedTrips = tripsRef.current.filter(t => t.id !== tripId);
      setDisplayedTrips(updatedTrips);
      toast({
          title: 'Trip Archived',
          description: 'You can restore it from the settings page.',
      });
      setDeletingTripId(null);
    });
  };

  const handleDismissAlert = async (tripId: string, alertId: string) => {
    if (!userEmail) return;
    const tripToUpdate = tripsRef.current.find(t => t.id === tripId);
    if (!tripToUpdate) return;
  
    const newDismissedAlertIds = [...(tripToUpdate.dismissedAlertIds || []), alertId];
    
    const updatedTrips = tripsRef.current.map(t => 
      t.id === tripId 
        ? { ...t, dismissedAlertIds: newDismissedAlertIds }
        : t
    );
    setDisplayedTrips(updatedTrips);
  
    await updateTrip(userEmail, tripId, { dismissedAlertIds: newDismissedAlertIds });
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

  const formAction = () => {
    if (!userEmail) {
        toast({
            variant: 'destructive',
            title: 'Not Logged In',
            description: 'You must be logged in to sync with the AI.',
        });
        return;
    }
    setSystemLogs([`[${new Date().toLocaleTimeString()}] User ${userEmail} initiated new scan...`]);
    startTransition(async () => {
      const result = await handleSync(userEmail);
      
      if (!result) {
        const errorMessage = 'An unexpected error occurred: the sync process did not return a result.';
        setSystemLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] FATAL: ${errorMessage}`]);
        toast({
          variant: 'destructive',
          title: 'Scan Failed',
          description: errorMessage,
        });
        setActionResult({ type: 'error', trips: [], message: errorMessage, logs: [] });
        return;
      }

      setActionResult(result);
      if (result.logs) {
        setSystemLogs(result.logs);
      }
      if (result.type === 'success') {
        setDisplayedTrips(result.trips.filter(trip => !trip.isArchived));
        toast({
            title: 'Scan Complete',
            description: result.message || 'Your trips have been updated.',
        });
      } else if (result.type === 'error') {
          toast({
              variant: 'destructive',
              title: 'Scan Failed',
              description: result.message || 'An unknown error occurred during the scan.',
          });
      }
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(displayedTrips);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setDisplayedTrips(items);
  };

  const allAlerts = displayedTrips.flatMap(trip => 
    (trip.alerts || [])
      .filter(alert => !(trip.dismissedAlertIds || []).includes(alert.id))
      .map(alert => ({...alert, tripName: trip.tripName, tripId: trip.id}))
  ).slice(0, 3);

  const { nextSegment, currentLocation } = React.useMemo(() => {
    const allSegments = displayedTrips.flatMap(trip => trip.segments);
    const now = new Date();

    const upcomingSegments = allSegments
      .filter(segment => new Date(segment.startDate) > now && !segment.isArchived)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const nextSeg = upcomingSegments[0] || null;

    const completedSegments = allSegments
      .filter(segment => new Date(segment.endDate) < now && !segment.isArchived)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    const lastCompletedSegment = completedSegments[0] || null;

    const currentLoc = lastCompletedSegment?.details.to || lastCompletedSegment?.location || 'your current location';
    
    return { nextSegment: nextSeg, currentLocation: currentLoc };
  }, [displayedTrips]);
  
  const nonEmptyTrips = displayedTrips.filter(t => t.segments.some(s => !s.isArchived));

  if (authLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-background text-foreground font-body">
      <header className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold font-headline">VoyageAI</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings" passHref>
            <Button variant="ghost" size="icon">
              <Cog className="h-6 w-6" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" type="button" onClick={handleLogout}>
            <LogOut className="h-6 w-6" />
          </Button>
          <form action={formAction}>
            <Button type="submit" variant="default" disabled={isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
              Sync with AI
            </Button>
          </form>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-4 font-headline">Your Trips</h2>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="trips">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {isPending && nonEmptyTrips.length === 0 ? (
                        <div className="flex items-center justify-center space-x-2 text-muted-foreground h-64">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Scanning your inbox for trips...</span>
                        </div>
                      ) : nonEmptyTrips.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full space-y-4" onValueChange={handleAccordionChange}>
                          {nonEmptyTrips.map((trip, index) => (
                            <Draggable key={trip.id} draggableId={trip.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn('transition-opacity duration-300', {
                                    'opacity-0': deletingTripId === trip.id,
                                  })}
                                >
                                  <AccordionItem
                                    value={trip.id}
                                    data-radix-accordion-item
                                    data-value={trip.id}
                                    className="border-b-0"
                                  >
                                    <Card
                                      onDoubleClick={() => router.push(`/trip/${trip.id}`)}
                                      className="bg-card shadow-lg border-border/50 rounded-xl overflow-hidden cursor-pointer border-l-4"
                                      style={{ borderLeftColor: getTripColor(trip.id) }}
                                    >
                                      <AccordionTrigger className="p-4 hover:no-underline w-full">
                                        <div className="flex items-center justify-between w-full gap-4">
                                          <div className="flex items-center gap-4">
                                            <div {...provided.dragHandleProps} className="p-2 cursor-grab text-muted-foreground hover:text-foreground">
                                              <GripVertical className="h-5 w-5" />
                                            </div>
                                            {trip.icon && (
                                              <div 
                                                className="h-6 w-6 text-primary" 
                                                dangerouslySetInnerHTML={{ __html: trip.icon }} 
                                              />
                                            )}
                                            <div className="text-left flex-grow min-w-0">
                                              <CardTitle className="text-lg font-bold text-foreground truncate font-headline">{trip.tripName}</CardTitle>
                                              <div className="text-sm text-muted-foreground pt-1 h-4">
                                                {isClient ? (
                                                  <div>{`${format(new Date(trip.startDate), 'EEE, MMM d')} - ${format(new Date(trip.endDate), 'EEE, MMM d')}`}</div>
                                                ) : (
                                                  <Skeleton className="h-full w-48" />
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge
                                              variant="outline"
                                              className="font-semibold shrink-0"
                                            >
                                              {trip.primaryDestination}
                                            </Badge>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleArchiveTrip(trip.id);
                                              }}
                                              disabled={isPending}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent className="px-4 pb-4">
                                        <div className="border-t border-border/50 pt-4">
                                          <div className="grid grid-cols-2 gap-4 mb-4">
                                            <StatItem icon={<CalendarDays className="h-5 w-5" />} label="Start Date" value={isClient ? format(new Date(trip.startDate), 'E, MMM d') : '...'} />
                                            <StatItem icon={<Hash className="h-5 w-5" />} label="Segments" value={trip.segments.filter(s => !s.isArchived).length} />
                                            <StatItem icon={<CalendarOff className="h-5 w-5" />} label="End Date" value={isClient ? format(new Date(trip.endDate), 'E, MMM d') : '...'} />
                                            <StatItem icon={<AlertTriangle className="h-5 w-5" />} label="Alerts" value={(trip.alerts || []).filter(a => !(trip.dismissedAlertIds || []).includes(a.id)).length} />
                                            <StatItem icon={<Users className="h-5 w-5" />} label="Travelers" value={trip.travelers?.length || 1} />
                                          </div>
                                          <Link href={`/trip/${trip.id}`} passHref>
                                            <Button className="w-full">
                                              <Plane className="mr-2 h-4 w-4" />
                                              View Full Itinerary
                                            </Button>
                                          </Link>
                                        </div>
                                      </AccordionContent>
                                    </Card>
                                  </AccordionItem>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </Accordion>
                      ) : (
                        <Card className="text-center bg-card/50 border-dashed">
                          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
                            <div className="bg-primary/10 p-3 rounded-full">
                              <Briefcase className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold font-headline">Welcome to VoyageAI</h3>
                            <p className="text-muted-foreground max-w-md">
                              Your smart travel assistant is ready. Click the "Sync with AI" button to automatically scan the shared inbox for flights, hotels, and other reservations to build your first trip itinerary.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            <aside className="lg:col-span-1 space-y-8">
              <Card className="bg-card shadow-lg border-border/50 rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-headline">Current Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>You are in <span className="font-semibold">{currentLocation}</span></span>
                    </div>
                    {nextSegment ? (
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>Next: <span className="font-semibold">{nextSegment.details.provider || nextSegment.description}</span>.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>No upcoming travel plans found.</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card shadow-lg border-border/50 rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-headline">Dashboard Alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {actionResult?.type === 'error' && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Scan Failed</AlertTitle>
                      <AlertDescription>{actionResult.message}</AlertDescription>
                    </Alert>
                  )}
                  {isClient && allAlerts.length > 0 ? (
                    allAlerts.map((alert) => (
                      <div key={alert.id} className="relative group/alert">
                        <Alert variant={'caution'}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>{alert.title}</AlertTitle>
                          <AlertDescription className="text-xs pr-6">
                            For trip '{alert.tripName}', {alert.description.toLowerCase()}
                          </AlertDescription>
                        </Alert>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 text-muted-foreground opacity-0 group-hover/alert:opacity-100 transition-opacity"
                          onClick={() => handleDismissAlert(alert.tripId, alert.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  ) : !isClient ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    actionResult?.type !== 'error' && (
                      <div className="text-sm text-muted-foreground text-center py-4">No active alerts.</div>
                    )
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </main>
      </div>

      <footer className="w-full z-10 bg-card">
        <Collapsible open={isLogOpen} onOpenChange={setIsLogOpen} className="w-full">
          <CollapsibleContent>
            <div className="bg-gray-900/95 backdrop-blur-sm p-4 h-48 overflow-y-auto font-mono text-xs text-gray-400 border-t border-primary/50">
              {systemLogs.map((log, index) => (
                <p key={index} className={cn('whitespace-pre-wrap', log.includes('ERROR') || log.includes('FATAL') ? 'text-red-400' : '')}>
                  {log}
                </p>
              ))}
              {isPending && <p className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Processing...</p>}
            </div>
          </CollapsibleContent>
          <CollapsibleTrigger asChild>
            <div className="bg-card text-foreground font-semibold flex items-center justify-between w-full h-10 px-4 cursor-pointer border-t border-border/50">
              <p className="text-sm font-headline">{'>'} System Log</p>
              {isLogOpen ? <ChevronsDown className="h-5 w-5" /> : <ChevronsUp className="h-5 w-5" />}
            </div>
          </CollapsibleTrigger>
        </Collapsible>
      </footer>
    </div>
  );
}
