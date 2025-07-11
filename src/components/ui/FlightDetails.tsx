
'use client';

import React from 'react';
import { format } from 'date-fns';
import type { GroupSegmentsIntoTripsOutput } from '@/ai/flows/group-segments-into-trips';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Plane, PlaneTakeoff, PlaneLanding, Hash, Wifi, TramFront, Ticket, GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/lib/settings-types';
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

type Segment = GroupSegmentsIntoTripsOutput[number]['segments'][number] & {
    originalStartDate?: string;
    originalEndDate?: string;
};
type Trip = GroupSegmentsIntoTripsOutput[number];

const formatTime = (dateStr: string) => format(new Date(dateStr), 'h:mm a');
const formatDate = (dateStr: string) => format(new Date(dateStr), 'E, MMM d');
const formatDateTime = (dateStr: string) => format(new Date(dateStr), 'E, MMM d, yyyy @ h:mm a');

const getStatusBadgeClass = (status: string, originalClassName: string, settings: AppSettings): string => {
    if (!status) return originalClassName;
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('delayed')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (lowerStatus.includes('cancelled')) return 'bg-destructive/20 text-destructive border-destructive/30';
    if (lowerStatus.includes('on time')) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (lowerStatus.includes('enroute') || lowerStatus.includes('in-route')) return 'bg-primary/20 text-primary border-primary/30';
    return originalClassName;
};

export default function FlightDetails({ 
    segment, 
    value,
    onTrackFlight, 
    isUpdating,
    originalStatus,
    nextSegment,
    onGetTransport,
    onShowBoardingPass,
    settings,
    dragHandleProps,
    onDelete,
}: { 
    segment: Segment, 
    trip: Trip, 
    value: string,
    onTrackFlight: () => void, 
    isUpdating: boolean,
    originalStatus: { text: string; className: string },
    nextSegment?: Segment,
    onGetTransport: (origin: string, destination: string) => void,
    onShowBoardingPass: (dataUri: string) => void,
    settings: AppSettings,
    dragHandleProps?: DraggableProvidedDragHandleProps | null,
    onDelete: () => void;
}) {
    const statusText = segment.status || originalStatus.text;
    
    const isTimeDelayed = segment.originalStartDate ? new Date(segment.startDate) > new Date(segment.originalStartDate) : false;
    const isStatusDelayed = statusText.toLowerCase().includes('delayed');
    const isDelayed = isTimeDelayed || isStatusDelayed;
    
    const statusClassName = getStatusBadgeClass(statusText, originalStatus.className, settings);
    const flightIdent = segment.details.airlineCode && segment.details.flightNumber ? `${segment.details.airlineCode}${segment.details.flightNumber}` : segment.details.flightNumber || '';

    const handleTransportClick = () => {
        if (nextSegment && segment.details.to) {
            onGetTransport(segment.details.to, nextSegment.details.from || nextSegment.location);
        }
    };
    
    const fromAirport = segment.details.from?.split(',')[0].split(' ')[0] || 'Origin';
    const toAirport = segment.details.to?.split(',')[0].split(' ')[0] || 'Destination';

    const delayColor = settings.appearance.colors.delay;

    return (
        <AccordionItem value={value} className="border-none">
            <Card className="bg-card shadow-lg border-border/50 overflow-hidden transition-all duration-300 border-l-4" style={{borderLeftColor: settings.appearance.colors.flight}}>
                <AccordionTrigger className="p-4 hover:no-underline focus:ring-1 focus:ring-primary/50 rounded-lg group">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-4 text-left min-w-0">
                            <div {...dragHandleProps} className="p-1 cursor-grab text-muted-foreground hover:text-foreground">
                                <GripVertical className="h-5 w-5"/>
                            </div>
                            <div style={{color: settings.appearance.colors.flight}} className="shrink-0"><Plane className="h-5 w-5" /></div>
                            <div className="min-w-0">
                                <p className="font-semibold text-lg truncate">{fromAirport} → {toAirport}</p>
                                <p className="text-sm text-muted-foreground">{formatTime(segment.startDate)} → {formatTime(segment.endDate)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end text-right ml-4 shrink-0">
                                <p className="font-semibold text-base text-foreground truncate">{segment.details.provider || 'Airline'}</p>
                                <Badge variant="outline" className={cn("mt-1 text-xs", statusClassName)}>
                                    {statusText}
                                </Badge>
                                <p className="text-sm text-muted-foreground mt-1">{formatDate(segment.startDate)}</p>
                            </div>
                             <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                    <div className="border-t border-border/50 mt-2 pt-4 space-y-4 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div className="flex items-start gap-3">
                                <PlaneTakeoff className="h-4 w-4 mt-0.5 text-primary" />
                                <div>
                                    <span className="font-semibold">Departure</span>
                                    <p className="text-muted-foreground" style={isDelayed ? { color: delayColor, fontWeight: 600 } : {}}>
                                        {segment.details.from}<br/>{formatDateTime(segment.startDate)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <PlaneLanding className="h-4 w-4 mt-0.5 text-primary" />
                                <div>
                                    <span className="font-semibold">Arrival</span>
                                    <p className="text-muted-foreground" style={isDelayed ? { color: delayColor, fontWeight: 600 } : {}}>
                                        {segment.details.to}<br/>{formatDateTime(segment.endDate)}
                                    </p>
                                </div>
                            </div>
                            {segment.details.confirmations?.map((conf, idx) => (
                                <div key={idx} className="col-span-1">
                                    <div className="flex items-start gap-3 mb-2">
                                        <Hash className="h-4 w-4 mt-0.5 text-primary" />
                                        <div>
                                            <span className="font-semibold">Confirmation #</span>
                                            {conf.travelerName && <p className="text-muted-foreground text-xs">({conf.travelerName})</p>}
                                            <p className="text-muted-foreground font-mono text-xs">{conf.number || 'N/A'}</p>
                                        </div>
                                    </div>
                                    {conf.boardingPassDataUri && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => onShowBoardingPass(conf.boardingPassDataUri!)}
                                        >
                                            <Ticket className="mr-2 h-4 w-4" />
                                            Boarding Pass
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {flightIdent && <div className="flex items-start gap-3"><Plane className="h-4 w-4 mt-0.5 text-primary" /><div><span className="font-semibold">Flight</span><p className="text-muted-foreground">{flightIdent}</p></div></div>}
                        </div>
                        <div className="flex items-center gap-2">
                            {flightIdent && (
                                <Button onClick={onTrackFlight} variant="outline" size="sm" disabled={isUpdating}>
                                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wifi className="mr-2 h-4 w-4"/>}
                                    {isUpdating ? 'Updating...' : 'Track Live Status'}
                                </Button>
                            )}
                            {nextSegment && (
                                <Button onClick={handleTransportClick} variant="outline" size="sm">
                                    <TramFront className="mr-2 h-4 w-4"/>
                                    Find Onward Travel
                                </Button>
                            )}
                        </div>
                    </div>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
