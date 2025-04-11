'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useKafka } from '@/contexts/KafkaContext';

interface ProduceMessageModalProps {
  isOpen: boolean;
  topicName: string;
  onClose: () => void;
  onSuccess: (data?: { messageCount?: number }) => void;
}

export default function ProduceMessageModal({ 
  isOpen, 
  topicName, 
  onClose,
  onSuccess
}: ProduceMessageModalProps) {
  const { connection } = useKafka();
  const [key, setKey] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [partition, setPartition] = useState<string>('');
  
  const produceMutation = useMutation({
    mutationFn: async () => {
      if (!connection) throw new Error('Not connected to Kafka');
      
      const response = await fetch('/api/kafka/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokers: connection.brokers,
          clientId: connection.clientId,
          topic: topicName,
          messages: [
            {
              key: key || null,
              value,
              partition: partition ? parseInt(partition, 10) : undefined
            }
          ]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to produce message');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setKey('');
      setValue('');
      setPartition('');
      // Pass success data to parent component
      onSuccess(data);
      onClose();
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold mb-4">Produce Message to {topicName}</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Key (optional)
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Message key"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Value
          </label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
            placeholder="Message value (JSON, text, etc.)"
            required
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Partition (optional)
          </label>
          <input
            type="number"
            min="0"
            value={partition}
            onChange={(e) => setPartition(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Specific partition number"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to use the default partitioner
          </p>
        </div>
        
        {produceMutation.error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
            {(produceMutation.error as Error).message}
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={produceMutation.isPending}
          >
            Cancel
          </button>
          <button
            onClick={() => produceMutation.mutate()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
            disabled={!value || produceMutation.isPending}
          >
            {produceMutation.isPending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}
