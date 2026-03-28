"use client";

import { ReactNode } from 'react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';

// Replace with your Convex deployment URL after running `npx convex dev`
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://your-app.convex.cloud';
const convex = new ConvexReactClient(CONVEX_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
