'use client';

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useKafka } from '@/contexts/KafkaContext';
import { KafkaConnectionConfig } from '@/types/kafka';

interface FormInputs {
  brokers: string;
  clientId: string;
}

export default function ConnectionForm() {
  const { setConnection } = useKafka();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors } } = useForm<FormInputs>({
    defaultValues: {
      brokers: 'localhost:9092',
      clientId: 'kafka-ui-admin'
    }
  });

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setIsLoading(true);
    setError(null);
    
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
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to connect to Kafka');
      }
      
      setConnection(config);
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
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Broker(s)
          </label>
          <input
            {...register('brokers', { required: 'Brokers are required' })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="localhost:9092,localhost:9093"
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
