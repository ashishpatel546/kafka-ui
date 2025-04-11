'use client';

import { Fragment } from 'react';
import { KafkaConnectionConfig } from '@/types/kafka';

type TabType = 'topics' | 'messages' | 'consumers';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  disconnect: () => void;
  connectionInfo: KafkaConnectionConfig | null;
}

export default function Navbar({ activeTab, setActiveTab, disconnect, connectionInfo }: NavbarProps) {
  return (
    <header className="bg-white shadow">
      <div className="px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold text-gray-900">Kafka UI</h1>
          
          {connectionInfo && (
            <div className="text-sm text-gray-500">
              Connected to: {connectionInfo.brokers.join(', ')}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('topics')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'topics' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Topics
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'messages' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => setActiveTab('consumers')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'consumers' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Consumer Groups
            </button>
          </nav>
          
          <button
            onClick={disconnect}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Disconnect
          </button>
        </div>
      </div>
    </header>
  );
}
