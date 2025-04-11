'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useKafka } from '@/contexts/KafkaContext';
import { KafkaMessage, MessageSearchParams, Topic } from '@/types/kafka';
import MessageSearchForm from '@/components/topics/MessageSearchForm';

interface TopicMessagesProps {
  selectedTopic: string | null;
  onSelectTopic: (topicName: string) => void;
}

export default function TopicMessages({ selectedTopic, onSelectTopic }: TopicMessagesProps) {
  const { connection } = useKafka();
  const [searchParams, setSearchParams] = useState<MessageSearchParams>({
    topic: selectedTopic || '',
    limit: 100,
    fromBeginning: true
  });
  
  const { data: topicsData } = useQuery({
    queryKey: ['topics', connection?.brokers, connection?.clientId],
    queryFn: async () => {
      if (!connection) return null;
      
      const queryParams = new URLSearchParams({
        brokers: connection.brokers.join(','),
        clientId: connection.clientId
      });
      
      const response = await fetch(`/api/kafka/topics?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch topics');
      
      return await response.json();
    },
    enabled: !!connection
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['messages', connection?.brokers, connection?.clientId, searchParams],
    queryFn: async () => {
      if (!connection || !searchParams.topic) {
        return null;
      }
      
      const response = await fetch('/api/kafka/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokers: connection.brokers,
          clientId: connection.clientId,
          ...searchParams
        })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Failed to fetch messages');
      }
      
      return await response.json();
    },
    enabled: !!connection && !!searchParams.topic
  });

  const handleSearch = (params: MessageSearchParams) => {
    setSearchParams(params);
  };

  if (!selectedTopic) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white p-6 shadow rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Select a Topic</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {topicsData?.topics?.map((topic: Topic) => (
              <button
                key={topic.name}
                onClick={() => onSelectTopic(topic.name)}
                className="p-4 border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-200 transition-colors text-left"
              >
                <div className="font-medium">{topic.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {topic.partitions.length} partition(s)
                </div>
              </button>
            ))}
          </div>
          
          {(!topicsData?.topics || topicsData.topics.length === 0) && (
            <div className="text-center py-10">
              <p className="text-gray-500">No topics available</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Messages: {selectedTopic}</h2>
        <button
          onClick={() => onSelectTopic('')}
          className="text-blue-600 hover:text-blue-800"
        >
          Change Topic
        </button>
      </div>
      
      <MessageSearchForm
        selectedTopic={selectedTopic}
        partitions={data?.partitions || []}
        initialValues={searchParams}
        onSearch={handleSearch}
      />
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md my-4">
          Error: {(error as Error).message}
          <button 
            onClick={() => refetch()}
            className="ml-2 underline"
          >
            Try Again
          </button>
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-10">Loading messages...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Offset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.messages?.map((message: KafkaMessage, index: number) => (
                  <tr key={`${message.partition}-${message.offset}-${index}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {message.partition}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {message.offset}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {message.key || <span className="text-gray-400">null</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md overflow-hidden">
                      <div className="max-h-24 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-all">
                          {message.value || <span className="text-gray-400">null</span>}
                        </pre>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(Number(message.timestamp)).toLocaleString()}
                    </td>
                  </tr>
                ))}
                
                {(!data?.messages || data.messages.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      No messages found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {data?.messages && data.messages.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
              Showing {data.messages.length} message{data.messages.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
