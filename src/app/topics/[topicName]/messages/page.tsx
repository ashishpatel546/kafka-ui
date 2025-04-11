'use client';

import { useKafka } from '@/contexts/KafkaContext';
import ConnectionForm from '@/components/ConnectionForm';
import TopicMessages from '@/components/topics/TopicMessages';
import Navbar from '@/components/Navbar';
import { useRouter, useParams } from 'next/navigation';

export default function TopicMessagesPage() {
  const { isConnected, connection, disconnect } = useKafka();
  const params = useParams();
  const router = useRouter();
  
  // Get the topic name from URL params
  const topicName = Array.isArray(params.topicName) 
    ? params.topicName[0] 
    : params.topicName as string;

  const handleSelectTopic = (newTopicName: string) => {
    router.push(`/topics/${encodeURIComponent(newTopicName)}/messages`);
  };

  return (
    <main className="h-screen flex flex-col">
      {!isConnected ? (
        <div className="p-4 md:p-8">
          <div className="max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Kafka UI</h1>
            <ConnectionForm />
          </div>
        </div>
      ) : (
        <>
          <Navbar activeTab="messages" disconnect={disconnect} connectionInfo={connection} />
          <div className="flex-grow overflow-auto p-4">
            <TopicMessages 
              selectedTopic={topicName} 
              onSelectTopic={handleSelectTopic} 
            />
          </div>
        </>
      )}
    </main>
  );
}
