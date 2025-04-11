'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useKafka } from '@/contexts/KafkaContext';
import { KafkaMessage, MessageSearchParams, Topic, ConsumerGroupLag } from '@/types/kafka';
import MessageSearchForm from '@/components/topics/MessageSearchForm';
import ProduceMessageModal from '@/components/topics/ProduceMessageModal';
import Link from 'next/link';

// Use a fixed consumer group ID to match with server-side
const CONSUMER_GROUP_ID = 'kafka-ui-consumer';

interface TopicMessagesProps {
  selectedTopic: string | null;
  onSelectTopic?: (topicName: string) => void;
}

export default function TopicMessages({ selectedTopic, onSelectTopic }: TopicMessagesProps) {
  const { connection, addConsumerGroup } = useKafka();
  const [searchParams, setSearchParams] = useState<MessageSearchParams>({
    topic: selectedTopic || '',
    limit: 100,
    readingMode: 'latest',
    autoRefresh: true, // Set auto-refresh to be enabled by default
  });
  const [isProduceModalOpen, setIsProduceModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Store the highest offsets we've seen per partition to track new messages
  const highestOffsets = useRef<Record<number, string>>({});
  // Store all messages we've retrieved
  const allMessages = useRef<KafkaMessage[]>([]);

  const { data: topicsData } = useQuery({
    queryKey: ['topics', connection?.brokers, connection?.clientId],
    queryFn: async () => {
      if (!connection) return null;

      const queryParams = new URLSearchParams({
        brokers: connection.brokers.join(','),
        clientId: connection.clientId,
      });

      const response = await fetch(`/api/kafka/topics?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch topics');

      return await response.json();
    },
    enabled: !!connection,
  });

  // Fetch topic metrics separately from messages to keep them independent of reading mode
  const { data: metricsData, refetch: refetchMetrics } = useQuery({
    queryKey: ['topic-metrics', connection?.brokers, connection?.clientId, selectedTopic],
    queryFn: async () => {
      if (!connection || !selectedTopic) return null;

      const metricsQueryParams = new URLSearchParams({
        brokers: connection.brokers.join(','),
        clientId: connection.clientId,
        topic: selectedTopic,
      });

      const metricsResponse = await fetch(`/api/kafka/topic-metrics?${metricsQueryParams}`);
      return metricsResponse.ok ? await metricsResponse.json() : null;
    },
    enabled: !!connection && !!selectedTopic,
    refetchInterval: 3000, // Always refresh metrics every 3 seconds
  });

  // Reset stored messages when search parameters or topic changes
  useEffect(() => {
    // Reset the stored messages and offsets when topic or search parameters change
    allMessages.current = [];
    highestOffsets.current = {};
  }, [searchParams.topic, searchParams.readingMode, searchParams.partition, searchParams.offset, searchParams.search]);

  // Fetch messages
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['messages', connection?.brokers, connection?.clientId, searchParams],
    queryFn: async () => {
      if (!connection || !searchParams.topic) {
        return null;
      }

      // Always add timestamp to ensure we get a fresh consumer for each request
      const effectiveParams = {
        ...searchParams,
        _timestamp: Date.now(), // Always add a timestamp to force a fresh consumer group
        // Making sure to specify a sufficient limit to show all available messages
        limit: searchParams.limit || 100,
      };

      // For "latest" reading mode with auto-refresh enabled, dynamically adjust behavior
      // to continuously get new messages
      let effectiveReadingMode = searchParams.readingMode || 'latest';

      // If we're on "latest" mode with auto-refresh, use offsets to get only new messages
      if (effectiveReadingMode === 'latest' && searchParams.autoRefresh && Object.keys(highestOffsets.current).length > 0) {
        // If we have seen messages before, use "specific" mode to start from the highest offsets
        effectiveReadingMode = 'specific';

        // Use the first partition we've seen (we'll handle multi-partition below)
        const firstPartition = Number(Object.keys(highestOffsets.current)[0]);
        const firstOffset = highestOffsets.current[firstPartition];
      }

      // Fetch messages
      const response = await fetch('/api/kafka/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokers: connection.brokers,
          clientId: connection.clientId,
          topic: searchParams.topic,
          limit: effectiveParams.limit,
          readingMode: effectiveReadingMode,
          search: searchParams.search,
          partition: searchParams.partition,
          offset: searchParams.offset,
          // Send the highest offsets we've seen for each partition
          highestOffsets: effectiveReadingMode === 'specific' ? highestOffsets.current : undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Failed to fetch messages');
      }

      const messagesData = await response.json();

      // Process and store messages - keep track of highest offsets
      if (messagesData.messages && messagesData.messages.length > 0) {
        // Update highest offsets for each partition
        messagesData.messages.forEach((msg: KafkaMessage) => {
          const currentPartitionOffset = highestOffsets.current[msg.partition];
          // Only update if this offset is higher or doesn't exist yet
          if (!currentPartitionOffset || BigInt(msg.offset) > BigInt(currentPartitionOffset)) {
            highestOffsets.current[msg.partition] = msg.offset;
          }
        });

        // If in latest mode with auto-refresh, append new messages to our stored list
        if (searchParams.readingMode === 'latest' && searchParams.autoRefresh) {
          // For refreshes, deduplicate messages by checking partition + offset combination
          const existingOffsetKeys = new Set(
            allMessages.current.map((msg) => `${msg.partition}-${msg.offset}`)
          );

          const newMessages = messagesData.messages.filter(
            (msg: KafkaMessage) => !existingOffsetKeys.has(`${msg.partition}-${msg.offset}`)
          );

          if (newMessages.length > 0) {
            allMessages.current = [...allMessages.current, ...newMessages];

            // Keep only the most recent "limit" messages
            const effectiveLimit = searchParams.limit ?? 100;
            if (allMessages.current.length > effectiveLimit) {
              allMessages.current = allMessages.current.slice(-effectiveLimit);
            }
          }
          
          // Always update the messagesData to include all stored messages - even if no new messages
          messagesData.messages = [...allMessages.current];
        } else {
          // For non-auto-refresh or non-latest modes, just use whatever was returned
          allMessages.current = messagesData.messages;
        }
      } else if (searchParams.autoRefresh && allMessages.current.length > 0) {
        // If no new messages but in auto-refresh mode, keep the existing messages instead of showing "No messages found"
        messagesData.messages = [...allMessages.current];
      }

      return messagesData;
    },
    enabled: !!connection && !!searchParams.topic,
    refetchInterval: searchParams.autoRefresh ? 3000 : false, // Auto-refresh if enabled
    // Ensure we always get fresh data on refetch
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const handleSearch = (params: MessageSearchParams) => {
    setSearchParams(params);
  };

  // Force an immediate refresh when a message is produced or when auto-refresh is toggled
  useEffect(() => {
    if (searchParams.autoRefresh) {
      refetch();
    }
  }, [searchParams.autoRefresh, refetch]);

  // Listen for consumer group IDs in server responses
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
      const response = await originalFetch(input, init);

      // Clone the response to read headers without consuming the body
      const clonedResponse = response.clone();

      // Check for our custom consumer group header
      const consumerGroupId = clonedResponse.headers.get('x-consumer-group-id');
      if (consumerGroupId) {
        // Register the consumer group with our KafkaContext
        addConsumerGroup(consumerGroupId);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [addConsumerGroup]);

  if (!selectedTopic) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white p-6 shadow rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Select a Topic</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {topicsData?.topics?.map((topic: Topic) => (
              <button
                key={topic.name}
                onClick={() => onSelectTopic && onSelectTopic(topic.name)}
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
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Messages: {selectedTopic}</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setIsProduceModalOpen(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Produce Message
            </button>
            <Link
              href="/topics"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Topics
            </Link>
          </div>
        </div>

        {metricsData?.metrics && (
          <div className="mt-2">
            <div className="flex space-x-6 mb-2">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-1"></span>
                <span className="text-sm">
                  Total Messages: {metricsData.metrics.totalMessages?.toLocaleString() || 'N/A'}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-orange-500 rounded-full mr-1"></span>
                <span className="text-sm">Total Lag: {metricsData.metrics.lag?.toLocaleString() || '0'}</span>
              </div>
            </div>
            
            {/* Consumer Group Lag Table */}
            {metricsData.metrics.consumerGroupLags && 
              // Filter out the UI's own consumer group and check if we have any left to display
              metricsData.metrics.consumerGroupLags.filter((group: ConsumerGroupLag) => 
                group.groupId !== CONSUMER_GROUP_ID
              ).length > 0 ? (
              <div className="mt-2 bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
                <h4 className="px-4 py-2 text-sm font-semibold bg-gray-50 border-b border-gray-200">
                  Consumer Group Lag Information
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Consumer Group
                        </th>
                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lag (messages)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metricsData.metrics.consumerGroupLags
                        .filter((group: ConsumerGroupLag) => group.groupId !== CONSUMER_GROUP_ID) // Filter out UI's own consumer group
                        .map((groupLag: ConsumerGroupLag) => (
                        <tr key={groupLag.groupId}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {groupLag.groupId}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                            <span className={`px-2 py-1 rounded-full ${groupLag.lag > 1000 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {groupLag.lag.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-2 p-4 bg-white border border-gray-200 rounded-md text-gray-500 text-sm">
                No external consumer groups are currently consuming this topic.
              </div>
            )}
          </div>
        )}
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
          <button onClick={() => refetch()} className="ml-2 underline">
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

      {successMessage && (
        <div className="bg-green-50 text-green-700 p-4 rounded-md my-4 flex justify-between">
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="text-green-900">
            ×
          </button>
        </div>
      )}

      <ProduceMessageModal
        isOpen={isProduceModalOpen}
        topicName={selectedTopic || ''}
        onClose={() => setIsProduceModalOpen(false)}
        onSuccess={(data?: { messageCount?: number }) => {
          // Show success message with message count
          const count = data?.messageCount || 1;
          setSuccessMessage(
            `✅ Successfully produced ${count} message${count !== 1 ? 's' : ''} to topic "${selectedTopic}"`
          );

          // Clear stored offsets to ensure we get fresh data after producing
          highestOffsets.current = {};
          allMessages.current = [];

          // Force refetch immediately to get the new messages
          refetch();
        }}
      />
    </div>
  );
}
