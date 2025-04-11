'use client';

import { useKafka } from '@/contexts/KafkaContext';
import ConnectionForm from '@/components/ConnectionForm';
import Navbar from '@/components/Navbar';
import BrokerDisplay from '@/components/BrokerDisplay';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Topic, ConsumerGroup } from '@/types/kafka';

interface TopicsData {
  topics: Topic[];
}

interface ConsumersData {
  consumerGroups: ConsumerGroup[];
}

export default function Home() {
  const { isConnected, disconnect, connection, brokerCount, brokerStatus } = useKafka();
  const [topicCounts, setTopicCounts] = useState({ total: 0, system: 0, user: 0 });
  const [consumerCount, setConsumerCount] = useState(0);

  // Fetch topics data
  const { data: topicsData } = useQuery<TopicsData | null>({
    queryKey: ['topics', connection?.brokers, connection?.clientId],
    queryFn: async () => {
      if (!connection) return null;
      
      const queryParams = new URLSearchParams({
        brokers: connection.brokers.join(','),
        clientId: connection.clientId
      });
      
      const response = await fetch(`/api/kafka/topics?${queryParams}`);
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    },
    enabled: !!connection && isConnected
  });

  // Fetch consumer groups data
  const { data: consumersData } = useQuery<ConsumersData | null>({
    queryKey: ['consumer-groups', connection?.brokers, connection?.clientId],
    queryFn: async () => {
      if (!connection) return null;
      
      const queryParams = new URLSearchParams({
        brokers: connection.brokers.join(','),
        clientId: connection.clientId
      });
      
      const response = await fetch(`/api/kafka/consumer-groups?${queryParams}`);
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    },
    enabled: !!connection && isConnected
  });

  // Calculate topic counts and consumer group counts
  useEffect(() => {
    if (topicsData?.topics) {
      const allTopics = topicsData.topics;
      const systemTopics = allTopics.filter((topic: Topic) => topic.name.startsWith('_'));
      
      setTopicCounts({
        total: allTopics.length,
        system: systemTopics.length,
        user: allTopics.length - systemTopics.length
      });
    }

    if (consumersData?.consumerGroups) {
      const filteredGroups = consumersData.consumerGroups.filter((group: ConsumerGroup) => 
        !group.groupId.startsWith('kafka-ui-') && group.groupId !== connection?.clientId
      );
      setConsumerCount(filteredGroups.length);
    }
  }, [topicsData, consumersData, connection]);

  return (
    <main className="min-h-screen flex flex-col">
      {!isConnected ? (
        <div className="p-4 md:p-8">
          <div className="max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Kafka UI</h1>
            <ConnectionForm />
          </div>
        </div>
      ) : (
        <>
          <Navbar activeTab="home" disconnect={disconnect} connectionInfo={connection} />
          <div className="flex-grow flex flex-col items-center p-4">
            <div className="max-w-3xl w-full">
              <h2 className="text-2xl font-bold mb-6 text-center">Connected to Kafka</h2>
              
              {/* Broker Display */}
              <div className="mb-6">
                <BrokerDisplay 
                  brokers={connection?.brokers || []} 
                  brokerCount={brokerCount}
                  brokerStatus={brokerStatus}
                />
              </div>
              
              <div className="flex justify-center gap-6 mb-6">
                <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg">
                  <span className="text-2xl font-bold text-blue-700">{topicCounts.total}</span>
                  <span className="text-sm text-blue-600">Total Topics</span>
                </div>
                <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
                  <span className="text-2xl font-bold text-green-700">{topicCounts.user}</span>
                  <span className="text-sm text-green-600">User Topics</span>
                </div>
                <div className="flex flex-col items-center p-4 bg-purple-50 rounded-lg">
                  <span className="text-2xl font-bold text-purple-700">{topicCounts.system}</span>
                  <span className="text-sm text-purple-600">System Topics</span>
                </div>
                <div className="flex flex-col items-center p-4 bg-amber-50 rounded-lg">
                  <span className="text-2xl font-bold text-amber-700">{consumerCount}</span>
                  <span className="text-sm text-amber-600">Consumer Groups</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Link 
                  href="/topics" 
                  className="flex flex-col items-center p-6 bg-white shadow-md hover:shadow-lg rounded-lg transition-shadow"
                >
                  <img src="/file.svg" alt="Topics" className="w-12 h-12 mb-3" />
                  <h3 className="font-semibold text-lg">Topics</h3>
                  <p className="text-sm text-gray-500">Browse and manage Kafka topics</p>
                  <div className="mt-2 text-xs text-blue-600">{topicCounts.total} topics ({topicCounts.user} user, {topicCounts.system} system)</div>
                </Link>
                
                <Link 
                  href="/consumers" 
                  className="flex flex-col items-center p-6 bg-white shadow-md hover:shadow-lg rounded-lg transition-shadow"
                >
                  <img src="/window.svg" alt="Consumers" className="w-12 h-12 mb-3" />
                  <h3 className="font-semibold text-lg">Consumer Groups</h3>
                  <p className="text-sm text-gray-500">Monitor consumer groups</p>
                  <div className="mt-2 text-xs text-blue-600">{consumerCount} consumer groups</div>
                </Link>
              </div>
              
              <div className="p-4 bg-white shadow-md rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Additional Information</h3>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <span className="text-gray-600">Client ID:</span>
                  </div>
                  <div>
                    <span className="font-semibold">{connection?.clientId}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center mt-8">
                <button 
                  onClick={() => disconnect()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
