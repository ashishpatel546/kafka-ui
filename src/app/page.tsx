'use client';

import { useKafka } from '@/contexts/KafkaContext';
import ConnectionForm from '@/components/ConnectionForm';
import KafkaDashboard from '@/components/KafkaDashboard';

export default function Home() {
  const { isConnected } = useKafka();

  return (
    <main className="min-h-screen p-4 md:p-8">
      {!isConnected ? (
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-center">Kafka UI</h1>
          <ConnectionForm />
        </div>
      ) : (
        <KafkaDashboard />
      )}
    </main>
  );
}
