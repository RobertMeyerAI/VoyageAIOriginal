
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth, isFirebaseConfigValid } from '@/lib/firebase';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function FinishSignInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigValid) {
        setStatus('error');
        setError('Firebase is not configured correctly.');
        return;
    }

    if (auth && isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please provide your email for confirmation');
      }

      if (!email) {
        setStatus('error');
        setError('Email not found. Please try signing in again.');
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Could not find the email for this sign-in link.' });
        router.push('/login');
        return;
      }

      signInWithEmailLink(auth, email, window.location.href)
        .then(() => {
          window.localStorage.removeItem('emailForSignIn');
          setStatus('success');
          toast({ title: 'Sign In Successful!', description: 'Redirecting you to the dashboard...' });
          router.push('/');
        })
        .catch((err) => {
          console.error(err);
          setStatus('error');
          let errorMessage = 'The sign-in link is invalid or has expired.';
          if (err.code === 'auth/invalid-action-code') {
            errorMessage = 'The sign-in link is invalid or has expired. Please try again.';
          }
          setError(errorMessage);
          toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
        });
    } else {
        setStatus('error');
        setError('This is not a valid sign-in link.');
        router.push('/login');
    }
  }, [router, toast]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <CardTitle>Verifying Sign-in...</CardTitle>
            <CardDescription>Please wait while we securely log you in.</CardDescription>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-8 w-8 text-green-500" />
            <CardTitle>Success!</CardTitle>
            <CardDescription>You are now signed in. Redirecting...</CardDescription>
          </>
        );
      case 'error':
        return (
          <>
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <CardTitle>Sign-in Failed</CardTitle>
            <CardDescription>{error || 'An unexpected error occurred.'}</CardDescription>
          </>
        );
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-fit">
               {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
               {status === 'success' && <CheckCircle className="h-12 w-12 text-green-500" />}
               {status === 'error' && <AlertTriangle className="h-12 w-12 text-destructive" />}
            </div>
            <div>
              {status === 'loading' && <CardTitle>Verifying Sign-in...</CardTitle>}
              {status === 'success' && <CardTitle>Success!</CardTitle>}
              {status === 'error' && <CardTitle>Sign-in Failed</CardTitle>}
            </div>
             <div>
              {status === 'loading' && <CardDescription>Please wait while we securely log you in.</CardDescription>}
              {status === 'success' && <CardDescription>You are now signed in. Redirecting...</CardDescription>}
              {status === 'error' && <CardDescription>{error || 'An unexpected error occurred.'}</CardDescription>}
            </div>
        </CardHeader>
      </Card>
    </div>
  );
}
