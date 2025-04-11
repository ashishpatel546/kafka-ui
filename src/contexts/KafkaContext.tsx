'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { KafkaConnectionConfig } from '@/types/kafka';

interface KafkaContextType {
  connection: KafkaConnectionConfig | null;
  isConnected: boolean;
  setConnection: (config: KafkaConnectionConfig) => void;
  disconnect: () => void;
}

const KafkaContext = createContext<KafkaContextType | undefined>(undefined);

export function KafkaProvider({ children }: { children: ReactNode }) {
  const [connection, setConnectionState] = useState<KafkaConnectionConfig | null>(null);

  const setConnection = (config: KafkaConnectionConfig) => {
    setConnectionState(config);
  };

  const disconnect = () => {
    setConnectionState(null);
  };

  return (
    <KafkaContext.Provider value={{
      connection,
      isConnected: !!connection,
      setConnection,
      disconnect
    }}>
      {children}
    </KafkaContext.Provider>
  );
}

export function useKafka() {
  const context = useContext(KafkaContext);
  
  if (context === undefined) {
    throw new Error('useKafka must be used within a KafkaProvider');
  }
  
  return context;
}
