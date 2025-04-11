'use client';

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useKafka } from '@/contexts/KafkaContext';
import { KafkaConnectionConfig } from '@/types/kafka';
import { useRouter } from 'next/navigation';

interface FormInputs {
  brokers: string;
  clientId: string;
}

interface ConnectionResult {
  brokerCount?: number;
  success: boolean;
  message: string;
}

export default function ConnectionForm() {
  const { setConnection } = useKafka();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);
  const [formState, setFormState] = useState<KafkaConnectionConfig>({
    clientId: 'kafka-ui-client',
    brokers: ['localhost:29092'],
  });
  const router = useRouter();
  
  const { register, handleSubmit, formState: { errors } } = useForm<FormInputs>({
    defaultValues: {
      brokers: 'localhost:29092',
      clientId: 'kafka-ui-admin'
    }
  });

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setIsLoading(true);
    setError(null);
    setConnectionResult(null);
    
    try {
      const brokers = data.brokers.split(',').map(broker => broker.trim());
      const config: KafkaConnectionConfig = {
        brokers,
        clientId: data.clientId
      };
      
      const response = await fetch('/api/kafka/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        // Handle non-JSON error responses
        let errorMessage = 'Failed to connect to Kafka';
        try {
          const result = await response.json();
          errorMessage = result.error || result.details || errorMessage;
        } catch (jsonError) {
          // If response is not valid JSON, use status text instead
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      // Store broker count and status in the context
      setConnection(config, result.brokerCount, result.brokerStatus);
      
      // Store connection result with broker count
      setConnectionResult({
        success: true,
        message: result.message,
        brokerCount: result.brokerCount
      });
      
      // Don't redirect immediately, allow user to see the broker count
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while connecting to Kafka');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Connect to Kafka</h2>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {connectionResult && connectionResult.success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4">
          {connectionResult.message}
          {connectionResult.brokerCount !== undefined && (
            <div className="mt-2">
              <span className="font-semibold">Number of brokers in cluster: </span>
              {connectionResult.brokerCount}
            </div>
          )}
          <div className="text-sm mt-2">Redirecting to dashboard...</div>
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Broker(s)
          </label>
          <input
            {...register('brokers', { required: 'Brokers are required' })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="localhost:29092,localhost:29093"
          />
          {errors.brokers && (
            <p className="text-red-500 text-sm mt-1">{errors.brokers.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Comma-separated list of broker addresses
          </p>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client ID
          </label>
          <input
            {...register('clientId', { required: 'Client ID is required' })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="kafka-ui-admin"
          />
          {errors.clientId && (
            <p className="text-red-500 text-sm mt-1">{errors.clientId.message}</p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-400"
        >
          {isLoading ? 'Connecting...' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
