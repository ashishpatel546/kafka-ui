'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKafka } from '@/contexts/KafkaContext';
import { Topic, CreateTopicRequest } from '@/types/kafka';
import CreateTopicModal from '@/components/topics/CreateTopicModal';
import DeleteTopicModal from '@/components/topics/DeleteTopicModal';

interface TopicListProps {
  onSelectTopic: (topicName: string) => void;
}

export default function TopicList({ onSelectTopic }: TopicListProps) {
  const { connection } = useKafka();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['topics', connection?.brokers, connection?.clientId],
    queryFn: async () => {
      if (!connection) return null;
      
      const queryParams = new URLSearchParams({
        brokers: connection.brokers.join(','),
        clientId: connection.clientId
      });
      
      const response = await fetch(`/api/kafka/topics?${queryParams}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to fetch topics');
      }
      
      const data = await response.json();
      return data;
    },
    enabled: !!connection
  });

  const createTopicMutation = useMutation({
    mutationFn: async (topicData: CreateTopicRequest) => {
      if (!connection) throw new Error('Not connected to Kafka');
      
      const response = await fetch('/api/kafka/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokers: connection.brokers,
          clientId: connection.clientId,
          topic: topicData
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to create topic');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      setIsCreateModalOpen(false);
    }
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (topicName: string) => {
      if (!connection) throw new Error('Not connected to Kafka');
      
      const response = await fetch('/api/kafka/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokers: connection.brokers,
          clientId: connection.clientId,
          topicName
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to delete topic');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      setTopicToDelete(null);
    }
  });

  if (isLoading) return <div className="text-center py-10">Loading topics...</div>;

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          Error: {(error as Error).message}
        </div>
        <button 
          onClick={() => refetch()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const topics = data?.topics || [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Kafka Topics</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create Topic
        </button>
      </div>
      
      {topics.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No topics found</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {topics.map((topic: Topic) => (
              <li key={topic.name} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <button
                    onClick={() => onSelectTopic(topic.name)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {topic.name}
                  </button>
                  <p className="text-sm text-gray-500 mt-1">
                    {topic.partitions.length} partition(s)
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => onSelectTopic(topic.name)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    View Messages
                  </button>
                  <button
                    onClick={() => setTopicToDelete(topic.name)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CreateTopicModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateTopic={(topic: CreateTopicRequest) => createTopicMutation.mutate(topic)}
        isSubmitting={createTopicMutation.isPending}
        error={createTopicMutation.error ? (createTopicMutation.error as Error).message : null}
      />
      
      <DeleteTopicModal
        isOpen={!!topicToDelete}
        topicName={topicToDelete || ''}
        onClose={() => setTopicToDelete(null)}
        onDelete={() => topicToDelete && deleteTopicMutation.mutate(topicToDelete)}
        isDeleting={deleteTopicMutation.isPending}
        error={deleteTopicMutation.error ? (deleteTopicMutation.error as Error).message : null}
      />
    </div>
  );
}
