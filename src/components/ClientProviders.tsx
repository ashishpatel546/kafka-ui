'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KafkaProvider } from '@/contexts/KafkaContext';

// Create a client component to handle all client-side providers
export default function ClientProviders({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  // Create a new QueryClient instance for React Query
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <KafkaProvider>
        {children}
      </KafkaProvider>
    </QueryClientProvider>
  );
}
