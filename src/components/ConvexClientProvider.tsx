"use client";

import { ReactNode } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

// Replace with your Convex deployment URL after running `npx convex dev`
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://your-app.convex.cloud';
const convex = new ConvexReactClient(CONVEX_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}
