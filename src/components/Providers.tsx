"use client";

import { AuthProvider } from '../lib/AuthContext';
import { ConvexClientProvider } from './ConvexClientProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <AuthProvider>{children}</AuthProvider>
    </ConvexClientProvider>
  );
}
