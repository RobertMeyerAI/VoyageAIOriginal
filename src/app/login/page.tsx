
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendSignInLinkToEmail,
} from 'firebase/auth';
import { auth, isFirebaseConfigValid } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type LoginMethod = 'email';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [method, setMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [signInDomain, setSignInDomain] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const [domain, setDomain] = useState('');

  useEffect(() => {
    setDomain(window.location.origin);
  }, []);
  
  useEffect(() => {
    if (!loading && user) {
        router.push('/');
    }
  }, [user, loading, router]);


  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    startTransition(async () => {
      const currentDomain = window.location.origin;
      const actionCodeSettings = {
        url: `${currentDomain}/finishSignIn`,
        handleCodeInApp: true,
      };

      try {
        if (!auth) throw new Error("Firebase not initialized");
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        setSignInDomain(currentDomain);
        setEmailSent(true);
        setError(null);
        toast({ title: 'Check Your Email', description: `A sign-in link has been sent to ${email}.` });
      } catch (err: any) {
        console.error("Email Link Error:", err);
        let errorTitle = 'Error';
        let errorMessage = 'Failed to send sign-in link. Please check the email and try again.';

        if (err.code === 'auth/operation-not-allowed') {
            errorTitle = 'Configuration Required';
            errorMessage = 'Email link sign-in is not enabled. Please go to the Firebase console, navigate to Authentication > Sign-in method, and enable the "Email/Password" provider, then ensure "Email link (passwordless sign-in)" is turned on.';
        } else if (err.code === 'auth/unauthorized-domain') {
            errorTitle = 'Configuration Error';
            errorMessage = `This app's domain (${domain}) is not authorized. Go to the Firebase Console > Authentication > Settings > Authorized Domains and add the required domain.`;
        }
        
        setError(errorMessage);
        toast({ 
            variant: 'destructive', 
            title: errorTitle, 
            description: errorMessage,
            duration: 9000,
        });
      }
    });
  };
  
  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  if (!isFirebaseConfigValid) {
    return (
       <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md border-destructive">
            <CardHeader className="text-center">
              <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Firebase Configuration Missing</CardTitle>
              <CardDescription>
                Your app is not connected to Firebase.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
                <p>The Firebase configuration seems to be missing or incomplete.</p>
                <p>Please go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Firebase Console</a>, select your project, find your web app's configuration settings, and ensure the `NEXT_PUBLIC_FIREBASE_*` values are correctly set in your environment.</p>
            </CardContent>
          </Card>
        </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-headline">
      <Card className="w-full max-w-md bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to TripSpark</CardTitle>
          <CardDescription>Your personal AI travel assistant.</CardDescription>
        </CardHeader>
        <CardContent>
            <div>
              {emailSent ? (
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <Mail className="mx-auto h-12 w-12 text-primary" />
                  <h3 className="mt-4 text-lg font-medium">Check your inbox!</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    A secure sign-in link for <strong>{signInDomain}</strong> has been sent to <strong>{email}</strong>. Open the link to complete your login.
                  </p>
                  <Button variant="link" onClick={() => { setEmailSent(false); setError(null); }}>
                    Use a different email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  {domain && (
                    <p className="text-sm text-center text-muted-foreground">
                      Sign in to your account on <span className="font-semibold text-foreground">{domain}</span>
                    </p>
                  )}
                  <Input
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isPending}
                    className="text-base"
                  />
                  <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Sign-In Link'}
                  </Button>
                </form>
              )}
            </div>
          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
