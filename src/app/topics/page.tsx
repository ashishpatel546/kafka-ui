'use client';

import { useKafka } from '@/contexts/KafkaContext';
import ConnectionForm from '@/components/ConnectionForm';
import Navbar from '@/components/Navbar';
import TopicList from '@/components/topics/TopicList';
import { useRouter } from 'next/navigation';

export default function TopicsPage() {
  const { isConnected, connection, disconnect } = useKafka();
  const router = useRouter();

  const handleSelectTopic = (topicName: string) => {
    router.push(`/topics/${encodeURIComponent(topicName)}/messages`);
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
          <Navbar activeTab="topics" disconnect={disconnect} connectionInfo={connection} />
          <div className="flex-grow overflow-auto p-4">
            <TopicList onSelectTopic={handleSelectTopic} />
          </div>
        </>
      )}
    </main>
  );
}
