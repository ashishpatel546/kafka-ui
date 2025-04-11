'use client';

import { useState } from 'react';
import { useKafka } from '@/contexts/KafkaContext';
import TopicList from '@/components/topics/TopicList';
import TopicMessages from '@/components/topics/TopicMessages';
import ConsumerGroups from '@/components/consumers/ConsumerGroups';
import Navbar from './Navbar';

type TabType = 'topics' | 'messages' | 'consumers';

export default function KafkaDashboard() {
  const { connection, disconnect } = useKafka();
  const [activeTab, setActiveTab] = useState<TabType>('topics');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const handleSelectTopic = (topicName: string) => {
    setSelectedTopic(topicName);
    setActiveTab('messages');
  };

  return (
    <div className="h-screen flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        disconnect={disconnect}
        connectionInfo={connection}
      />
      
      <div className="flex-grow overflow-auto p-4">
        {activeTab === 'topics' && (
          <TopicList onSelectTopic={handleSelectTopic} />
        )}
        
        {activeTab === 'messages' && (
          <TopicMessages 
            selectedTopic={selectedTopic} 
            onSelectTopic={handleSelectTopic} 
          />
        )}
        
        {activeTab === 'consumers' && (
          <ConsumerGroups />
        )}
      </div>
    </div>
  );
}
