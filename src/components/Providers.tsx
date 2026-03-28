"use client";

import { AuthProvider } from '../lib/AuthContext';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexClientProvider } from './ConvexClientProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <AuthProvider>{children}</AuthProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
