import React, { useEffect, useState } from 'react';

interface BrokerDisplayProps {
  brokers: string[];
  brokerCount?: number | null;
  brokerStatus?: any[] | null;
}

interface BrokerStatusInfo {
  address: string;
  isActive: boolean | null;
  isController?: boolean;
  nodeId?: number;
}

export default function BrokerDisplay({ brokers, brokerCount, brokerStatus }: BrokerDisplayProps) {
  const [brokerDetails, setBrokerDetails] = useState<BrokerStatusInfo[]>([]);
  
  useEffect(() => {
    // If we have detailed broker status information from the API
    if (brokerStatus && brokerStatus.length > 0) {
      const detailedStatus = brokerStatus.map(broker => {
        // Convert broker info from API to our display format
        const address = `${broker.host}:${broker.port}`;
        return {
          address,
          nodeId: broker.nodeId,
          isController: broker.isController,
          isActive: broker.isActive
        };
      });
      
      setBrokerDetails(detailedStatus);
    } else {
      // Fallback to just showing the broker addresses without status
      const basicBrokers = brokers.map(broker => ({
        address: broker,
        isActive: null
      }));
      
      setBrokerDetails(basicBrokers);
    }
  }, [brokers, brokerStatus]);
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">Kafka Brokers</h3>
        <span className="bg-teal-100 text-teal-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {brokerCount || brokers.length} {(brokerCount || brokers.length) === 1 ? 'broker' : 'brokers'}
        </span>
      </div>
      
      <div className="flex flex-col space-y-2">
        {brokerDetails.map((broker, index) => (
          <div 
            key={index}
            className="flex items-center p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex-shrink-0 mr-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm font-medium">
                  {broker.nodeId !== undefined ? broker.nodeId : index + 1}
                </span>
              </div>
            </div>
            <div className="flex-grow">
              <div className="text-sm font-medium text-gray-900">{broker.address}</div>
              <div className="text-xs text-gray-500">
                {broker.address.split(':')[0]} (Port: {broker.address.split(':')[1] || 'N/A'})
                {broker.isController && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-sm">Controller</span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              {broker.isActive !== null && (
                <span 
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset
                    ${broker.isActive 
                      ? 'bg-green-50 text-green-700 ring-green-600/20' 
                      : 'bg-red-50 text-red-700 ring-red-600/20'}`}
                >
                  {broker.isActive ? 'Active' : 'Inactive'}
                </span>
              )}
              {broker.isActive === null && (
                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20">
                  Status Unknown
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}