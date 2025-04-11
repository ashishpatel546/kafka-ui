'use client';

import { useKafka } from '@/contexts/KafkaContext';
import ConnectionForm from '@/components/ConnectionForm';
import ConsumerGroups from '@/components/consumers/ConsumerGroups';
import Navbar from '@/components/Navbar';

export default function ConsumersPage() {
  const { isConnected, connection, disconnect } = useKafka();

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
          <Navbar activeTab="consumers" disconnect={disconnect} connectionInfo={connection} />
          <div className="flex-grow overflow-auto p-4">
            <ConsumerGroups />
          </div>
        </>
      )}
    </main>
  );
}
