'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { KafkaConnection } from '@/types/kafka';

interface KafkaContextType {
  connection: KafkaConnection | null;
  isConnected: boolean;
  brokerCount: number | null;
  brokerStatus: any[] | null;
  setConnection: (config: KafkaConnection, brokerCount?: number, brokerStatus?: any[]) => void;
  disconnect: () => void;
  addConsumerGroup: (groupId: string) => void;
}

interface KafkaContextState {
  connection: KafkaConnection | null;
  brokerCount: number | null;
  brokerStatus: any[] | null;
  consumerGroups: string[]; // Track consumer groups created by this UI
}

const KafkaContext = createContext<KafkaContextType | undefined>(undefined);

// Local storage keys
const KAFKA_CONNECTION_KEY = 'kafka-ui-connection';
const KAFKA_BROKER_COUNT_KEY = 'kafka-ui-broker-count';
const KAFKA_BROKER_STATUS_KEY = 'kafka-ui-broker-status';
const KAFKA_CONSUMER_GROUPS_KEY = 'kafka-ui-consumer-groups';

export function KafkaProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage if available
  const [state, setState] = useState<KafkaContextState>(() => {
    if (typeof window === 'undefined') {
      return { connection: null, brokerCount: null, brokerStatus: null, consumerGroups: [] };
    }
    
    const savedConnection = localStorage.getItem(KAFKA_CONNECTION_KEY);
    const savedBrokerCount = localStorage.getItem(KAFKA_BROKER_COUNT_KEY);
    const savedBrokerStatus = localStorage.getItem(KAFKA_BROKER_STATUS_KEY);
    const savedGroups = localStorage.getItem(KAFKA_CONSUMER_GROUPS_KEY);
    
    return {
      connection: savedConnection ? JSON.parse(savedConnection) : null,
      brokerCount: savedBrokerCount ? parseInt(savedBrokerCount, 10) : null,
      brokerStatus: savedBrokerStatus ? JSON.parse(savedBrokerStatus) : null,
      consumerGroups: savedGroups ? JSON.parse(savedGroups) : []
    };
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (state.connection) {
      localStorage.setItem(KAFKA_CONNECTION_KEY, JSON.stringify(state.connection));
    } else {
      localStorage.removeItem(KAFKA_CONNECTION_KEY);
    }
    
    if (state.brokerCount !== null) {
      localStorage.setItem(KAFKA_BROKER_COUNT_KEY, state.brokerCount.toString());
    } else {
      localStorage.removeItem(KAFKA_BROKER_COUNT_KEY);
    }
    
    if (state.brokerStatus) {
      localStorage.setItem(KAFKA_BROKER_STATUS_KEY, JSON.stringify(state.brokerStatus));
    } else {
      localStorage.removeItem(KAFKA_BROKER_STATUS_KEY);
    }
    
    localStorage.setItem(KAFKA_CONSUMER_GROUPS_KEY, JSON.stringify(state.consumerGroups));
  }, [state]);

  const setConnection = (config: KafkaConnection, brokerCount?: number, brokerStatus?: any[]) => {
    setState(prev => ({ 
      ...prev, 
      connection: config, 
      brokerCount: brokerCount ?? prev.brokerCount,
      brokerStatus: brokerStatus ?? prev.brokerStatus
    }));
  };

  const addConsumerGroup = (groupId: string) => {
    if (!groupId.startsWith('kafka-ui-')) return; // Only track UI consumer groups
    
    setState(prev => {
      if (prev.consumerGroups.includes(groupId)) return prev;
      return {
        ...prev,
        consumerGroups: [...prev.consumerGroups, groupId]
      };
    });
  };

  const disconnect = async () => {
    // If we have consumer groups to clean up and a connection
    if (state.connection && state.consumerGroups.length > 0) {
      try {
        // Clean up consumer groups created by this UI
        for (const groupId of state.consumerGroups) {
          try {
            await fetch('/api/kafka/consumer-groups', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                brokers: state.connection.brokers,
                clientId: state.connection.clientId,
                groupId
              })
            });
          } catch (err) {
            // Error handled silently in production
          }
        }
      } catch (error) {
        // Error handled silently in production
      }
    }
    
    // Reset state
    setState({ connection: null, brokerCount: null, brokerStatus: null, consumerGroups: [] });
  };

  return (
    <KafkaContext.Provider value={{
      connection: state.connection,
      isConnected: !!state.connection,
      brokerCount: state.brokerCount,
      brokerStatus: state.brokerStatus,
      setConnection,
      disconnect,
      addConsumerGroup
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
