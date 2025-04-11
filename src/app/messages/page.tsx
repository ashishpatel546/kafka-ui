'use client';

import { useKafka } from '@/contexts/KafkaContext';
import ConnectionForm from '@/components/ConnectionForm';
import Navbar from '@/components/Navbar';
import MessageSearchForm from '@/components/topics/MessageSearchForm';
import { useState } from 'react';
import { MessageSearchParams } from '@/types/kafka';

export default function MessagesPage() {
  const { isConnected, connection, disconnect } = useKafka();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [partitions, setPartitions] = useState<number[]>([]);

  // Function to handle topic selection
  const handleTopicSelect = async (topic: string) => {
    setSelectedTopic(topic);
    try {
      // Fetch partitions for the selected topic
      const response = await fetch(`/api/kafka/topics/${topic}`);
      const topicData = await response.json();
      if (topicData && topicData.partitions) {
        setPartitions(Array.from({ length: topicData.partitions }, (_, i) => i));
      }
    } catch (error) {
      console.error('Failed to fetch topic partitions:', error);
      setPartitions([0]); // Default to partition 0 if fetch fails
    }
  };

  // Function to search for messages
  const searchMessages = async (params: MessageSearchParams) => {
    if (!params.topic) return;
    
    try {
      const queryParams = new URLSearchParams({
        topic: params.topic,
        limit: String(params.limit || 100),
        readingMode: params.readingMode || 'latest'
      });
      
      if (params.partition !== undefined && params.partition !== null && params.partition >= 0) {
        queryParams.append('partition', params.partition.toString());
      }
      
      if (params.offset !== undefined && params.offset !== null && params.offset !== '') {
        queryParams.append('offset', params.offset.toString());
      }
      
      if (params.search) {
        queryParams.append('search', params.search);
      }
      
      const response = await fetch(`/api/kafka/messages?${queryParams}`);
      const data = await response.json();
      
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
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
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Search Messages</h2>
              {selectedTopic ? (
                <MessageSearchForm
                  selectedTopic={selectedTopic}
                  partitions={partitions}
                  initialValues={{
                    topic: selectedTopic,
                    limit: 100,
                    readingMode: 'latest',
                  }}
                  onSearch={searchMessages}
                />
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Topic
                  </label>
                  <select
                    onChange={(e) => handleTopicSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a topic</option>
                    {connection?.topics?.map((topic: string) => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {selectedTopic && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Showing messages for topic: {selectedTopic}</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partition</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offset</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {messages.length > 0 ? (
                          messages.map((message, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap">{message.partition}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{message.offset}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{message.key || '-'}</td>
                              <td className="px-6 py-4">
                                <div className="max-w-md overflow-auto">
                                  <pre className="text-sm">{message.value ? 
                                    (typeof message.value === 'object' ? 
                                      JSON.stringify(message.value, null, 2) : 
                                      String(message.value)) : 
                                    '-'}</pre>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">{new Date(message.timestamp).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No messages found. Use the search form above to find messages.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}