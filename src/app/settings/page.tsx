
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { defaultSettings, type AppSettings } from '@/lib/settings-types';
import { getDBSettingsForUser, saveDBSettingsForUser } from '@/services/firestore';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import SettingsHeader from './_components/Header';
import ArchivedItemsManager from './_components/ArchivedItemsManager';

const settingsSchema = z.object({
    alerts: z.object({
        checkInLeadTimeHours: z.number().min(0).max(24),
        lodgingGapHours: z.number().min(0).max(72),
    }),
    appearance: z.object({
        colors: z.object({
            flight: z.string().regex(/^#([0-9a-f]{3,6})$/i, "Must be a valid hex color"),
            hotel: z.string().regex(/^#([0-9a-f]{3,6})$/i, "Must be a valid hex color"),
            train: z.string().regex(/^#([0-9a-f]{3,6})$/i, "Must be a valid hex color"),
            car: z.string().regex(/^#([0-9a-f]{3,6})$/i, "Must be a valid hex color"),
            delay: z.string().regex(/^#([0-9a-f]{3,6})$/i, "Must be a valid hex color"),
            gap: z.string().regex(/^#([0-9a-f]{3,6})$/i, "Must be a valid hex color"),
        })
    }),
    data: z.object({
        archiveDays: z.number().min(0).max(30),
    }),
    profile: z.object({
        travelerProfile: z.string().max(500, "Profile must be 500 characters or less."),
    }),
});


export default function SettingsPage() {
    const { toast } = useToast();
    const { userEmail, loading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const form = useForm<AppSettings>({
        resolver: zodResolver(settingsSchema),
        defaultValues: defaultSettings,
    });

    useEffect(() => {
        if (authLoading) return;
        
        if (userEmail) {
            setIsLoading(true);
            getDBSettingsForUser(userEmail).then(settings => {
                form.reset(settings);
                setIsLoading(false);
            }).catch(error => {
                console.error("Failed to load settings from DB:", error);
                toast({
                    variant: 'destructive',
                    title: 'Error Loading Settings',
                    description: 'Could not load your preferences. Using default settings.',
                });
                form.reset(defaultSettings); 
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
            form.reset(defaultSettings);
        }
    }, [form, toast, userEmail, authLoading]);

    const onSubmit = (data: AppSettings) => {
        if (!userEmail) {
            toast({ variant: 'destructive', title: "Not Logged In", description: "You must be logged in to save settings." });
            return;
        }
        saveDBSettingsForUser(userEmail, data);
        toast({
            title: "Settings Saved",
            description: "Your preferences have been updated.",
        });
    };
    
    const handleReset = () => {
        if (!userEmail) {
            toast({ variant: 'destructive', title: "Not Logged In", description: "You must be logged in to reset settings." });
            return;
        }
        form.reset(defaultSettings);
        saveDBSettingsForUser(userEmail, defaultSettings);
        toast({
            title: "Settings Reset",
            description: "All settings have been restored to their default values.",
        });
    }

    if (isLoading || authLoading) {
        return (
            <div className="flex flex-col min-h-screen w-full bg-background text-foreground">
                <header className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-3">
                        <Sparkles className="h-7 w-7 text-primary" />
                        <span className="text-xl font-bold font-headline">Loading Settings...</span>
                    </div>
                </header>
                <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
                    <div className="space-y-8">
                        <Skeleton className="h-48 w-full bg-muted" />
                        <Skeleton className="h-48 w-full bg-muted" />
                        <Skeleton className="h-32 w-full bg-muted" />
                        <Skeleton className="h-40 w-full bg-muted" />
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen w-full bg-background text-foreground font-body">
            <SettingsHeader />

            <main className="flex-1 p-4 md:p-8">
                <div className="space-y-8 max-w-4xl mx-auto">

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="font-headline">Alerts</CardTitle>
                                    <CardDescription>Customize when and how you receive alerts.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="alerts.checkInLeadTimeHours"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Check-in Reminder Lead Time</FormLabel>
                                                <FormControl>
                                                    <div className="flex items-center gap-4">
                                                        <Slider
                                                            value={[field.value]}
                                                            onValueChange={(value) => field.onChange(value[0])}
                                                            max={24}
                                                            step={1}
                                                        />
                                                        <span className="font-mono text-sm w-24 text-center">{field.value} hour(s)</span>
                                                    </div>
                                                </FormControl>
                                                <FormDescription>How many hours before a flight to trigger a check-in reminder. Set to 0 to disable.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="alerts.lodgingGapHours"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Lodging Gap Threshold</FormLabel>
                                                <FormControl>
                                                     <div className="flex items-center gap-4">
                                                        <Slider
                                                            value={[field.value]}
                                                            onValueChange={(value) => field.onChange(value[0])}
                                                            max={72}
                                                            step={1}
                                                        />
                                                        <span className="font-mono text-sm w-24 text-center">{field.value} hour(s)</span>
                                                    </div>
                                                </FormControl>
                                                <FormDescription>Minimum time between bookings to trigger a "potential lodging gap" alert.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="font-headline">Appearance</CardTitle>
                                    <CardDescription>Customize the look and feel of the app.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {Object.keys(form.watch('appearance.colors')).map((key) => (
                                             <FormField
                                                key={key}
                                                control={form.control}
                                                name={`appearance.colors.${key as keyof AppSettings['appearance']['colors']}`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="capitalize">{key} Color</FormLabel>
                                                        <FormControl>
                                                            <div className="flex items-center gap-2">
                                                              <Input type="color" {...field} className="w-12 h-10 p-1"/>
                                                              <Input type="text" {...field} placeholder="#794BC4" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                             <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="font-headline">Data Management</CardTitle>
                                    <CardDescription>Control how your trip data is managed.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="data.archiveDays"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Auto-archive Trips</FormLabel>
                                                <FormControl>
                                                    <div className="flex items-center gap-4">
                                                        <Slider
                                                            value={[field.value]}
                                                            onValueChange={(value) => field.onChange(value[0])}
                                                            max={30}
                                                            step={1}
                                                        />
                                                         <span className="font-mono text-sm w-24 text-center">{field.value} day(s)</span>
                                                    </div>
                                                </FormControl>
                                                <FormDescription>How many days after a trip's end date to automatically remove it from the dashboard.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="font-headline">AI Personalization</CardTitle>
                                    <CardDescription>Provide context to the AI to get more personalized recommendations.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <FormField
                                        control={form.control}
                                        name="profile.travelerProfile"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Your Traveler Profile</FormLabel>
                                                <FormControl>
                                                    <Textarea {...field} rows={4} placeholder="e.g., I prefer window seats and always look for budget-friendly options..." />
                                                </FormControl>
                                                 <FormDescription>This helps the AI suggest better transportation options and other recommendations.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <div className="flex justify-end gap-4">
                                <Button type="button" variant="outline" onClick={handleReset}>Reset to Defaults</Button>
                                <Button type="submit">Save Settings</Button>
                            </div>
                        </form>
                    </Form>

                    <ArchivedItemsManager />

                </div>
            </main>
        </div>
    );
}
