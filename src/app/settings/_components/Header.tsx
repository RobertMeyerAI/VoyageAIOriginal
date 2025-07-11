
'use client';

import React, { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleSync } from '@/app/actions';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsHeader() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
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
      const result = await handleSync(userEmail);
      if (result.type === 'success') {
        toast({
          title: 'Sync Complete',
          description: 'Redirecting to dashboard...',
        });
        router.push('/');
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync Failed',
          description: result.message || 'An unknown error occurred.',
        });
      }
    });
  };

  return (
    <header className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-4">
        <Link href="/" passHref>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold font-headline">VoyageAI Settings</span>
        </div>
      </div>
      <Button variant="default" onClick={onSync} disabled={isPending}>
        <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
        Sync with AI
      </Button>
    </header>
  );
}
