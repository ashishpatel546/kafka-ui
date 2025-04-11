'use client';

import { useState, useMemo, useEffect } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSystemTopics, setShowSystemTopics] = useState(false);
  const [topicCounts, setTopicCounts] = useState({ total: 0, system: 0, user: 0 });
  
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

  // Always define all hooks at the top level, before any conditional returns
  const allTopics = data?.topics || [];
  
  // Calculate topic counts
  useEffect(() => {
    const systemTopics = allTopics.filter((topic: Topic) => topic.name.startsWith('_'));
    setTopicCounts({
      total: allTopics.length,
      system: systemTopics.length,
      user: allTopics.length - systemTopics.length
    });
  }, [allTopics]);
  
  // Filter topics based on search query and system topic visibility
  const filteredTopics = useMemo(() => {
    return allTopics.filter((topic: Topic) => {
      // Filter by search query if present
      const matchesSearch = searchQuery 
        ? topic.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      
      // Filter out system topics (starting with '_') if not showing them
      const isSystemTopic = topic.name.startsWith('_');
      const showTopic = showSystemTopics || !isSystemTopic;
      
      return matchesSearch && showTopic;
    });
  }, [allTopics, searchQuery, showSystemTopics]);

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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Kafka Topics</h2>
          <div className="flex gap-4 mt-1 text-sm">
            <div className="flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
              Total Topics: <span className="font-bold ml-1">{topicCounts.total}</span>
            </div>
            <div className="flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-full">
              User Topics: <span className="font-bold ml-1">{topicCounts.user}</span>
            </div>
            <div className="flex items-center px-3 py-1 bg-purple-50 text-purple-700 rounded-full">
              System Topics: <span className="font-bold ml-1">{topicCounts.system}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create Topic
        </button>
      </div>
      
      <div className="mb-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute left-3 top-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="showSystemTopics"
            checked={showSystemTopics}
            onChange={(e) => setShowSystemTopics(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
          />
          <label htmlFor="showSystemTopics" className="ml-2 text-sm font-medium text-gray-700">
            Show system topics (starting with '_')
          </label>
        </div>
      </div>
      
      {filteredTopics.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {searchQuery 
              ? "No matching topics found" 
              : showSystemTopics 
                ? "No topics found" 
                : "No topics found. Try enabling system topics to see more."}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredTopics.map((topic: Topic) => (
              <li key={topic.name} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <button
                    onClick={() => onSelectTopic(topic.name)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {topic.name}
                  </button>
                  <div className="flex space-x-4 text-sm text-gray-500 mt-1">
                    <p>{topic.partitions.length} partition(s)</p>
                    {topic.metrics && (
                      <>
                        <p className="flex items-center">
                          <span className="w-3 h-3 bg-green-500 rounded-full mr-1"></span>
                          <span>Total: {topic.metrics.totalMessages?.toLocaleString() || 'N/A'}</span>
                        </p>
                      </>
                    )}
                  </div>
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
