'use client';

import Link from 'next/link';
import { KafkaConnectionConfig } from '@/types/kafka';

type TabType = 'home' | 'topics' | 'consumers';

interface NavbarProps {
  activeTab: TabType;
  disconnect?: () => void;
  connectionInfo?: KafkaConnectionConfig | null;
}

export default function Navbar({ activeTab, disconnect, connectionInfo }: NavbarProps) {
  const handleDisconnect = () => {
    if (disconnect) {
      disconnect();
    }
  };

  return (
    <header className="bg-white shadow">
      <div className="px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">Kafka UI</h1>
          </Link>
          
          {connectionInfo && (
            <div className="text-sm text-gray-500">
              Connected to: {connectionInfo.brokers.join(', ')}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <nav className="flex space-x-1">
            <Link 
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'home' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Home
            </Link>
            <Link 
              href="/topics"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'topics' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Topics
            </Link>
            <Link 
              href="/consumers"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'consumers' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Consumer Groups
            </Link>
          </nav>
          
          {disconnect && (
            <button
              onClick={handleDisconnect}
              className="ml-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
