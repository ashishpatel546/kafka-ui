'use client';

import { useQuery } from '@tanstack/react-query';
import { useKafka } from '@/contexts/KafkaContext';

// Define interfaces for consumer group data
interface ConsumerGroup {
  groupId: string;
  state?: string;
  protocolType?: string;
  members?: GroupMember[];
}

interface GroupMember {
  memberId: string;
  clientId: string;
  clientHost: string;
  assignment?: {
    topicPartitions?: TopicPartition[];
  };
}

interface TopicPartition {
  topic: string;
  partitions: number[];
}

interface GroupOffset {
  groupId: string;
  offsets: TopicOffset[];
}

interface TopicOffset {
  topic: string;
  partitions: PartitionOffset[];
}

interface PartitionOffset {
  partition: number;
  offset: string;
}

export default function ConsumerGroups() {
  const { connection } = useKafka();
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['consumer-groups', connection?.brokers, connection?.clientId],
    queryFn: async () => {
      if (!connection) return null;
      
      const queryParams = new URLSearchParams({
        brokers: connection.brokers.join(','),
        clientId: connection.clientId
      });
      
      const response = await fetch(`/api/kafka/consumer-groups?${queryParams}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Failed to fetch consumer groups');
      }
      
      return await response.json();
    },
    enabled: !!connection
  });

  if (isLoading) {
    return <div className="text-center py-10">Loading consumer groups...</div>;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          Error: {(error as Error).message}
        </div>
        <button 
          onClick={() => refetch()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const consumerGroups = data?.consumerGroups as ConsumerGroup[] || [];
  const groupDescriptions = data?.groupDescriptions as ConsumerGroup[] || [];
  const offsetData = data?.offsetData as GroupOffset[] || [];

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Consumer Groups</h2>
      
      {consumerGroups.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No consumer groups found</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {consumerGroups.length} Consumer Group{consumerGroups.length !== 1 ? 's' : ''}
            </h3>
          </div>
          
          <ul className="divide-y divide-gray-200">
            {consumerGroups.map((group: ConsumerGroup) => {
              const groupDescription = groupDescriptions.find((g: ConsumerGroup) => g.groupId === group.groupId);
              const groupOffsets = offsetData.find((o: GroupOffset) => o.groupId === group.groupId);
              
              return (
                <li key={group.groupId} className="px-6 py-5">
                  <div>
                    <h4 className="text-lg font-semibold">{group.groupId}</h4>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <div className="text-sm text-gray-500">State: <span className="text-gray-900">{group.state || 'Unknown'}</span></div>
                        <div className="text-sm text-gray-500">Protocol Type: <span className="text-gray-900">{group.protocolType || 'Unknown'}</span></div>
                        <div className="text-sm text-gray-500">Members: <span className="text-gray-900">{groupDescription?.members?.length || 0}</span></div>
                      </div>
                    </div>
                    
                    {groupDescription?.members && groupDescription.members.length > 0 && (
                      <div className="mt-4">
                        <h5 className="font-medium text-gray-900 mb-2">Members</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client ID</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic Assignments</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {groupDescription.members.map((member: GroupMember) => (
                                <tr key={member.memberId}>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{member.clientId}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{member.clientHost}</td>
                                  <td className="px-3 py-2 text-sm text-gray-500">
                                    {member.assignment?.topicPartitions?.map((tp: TopicPartition) => (
                                      <div key={`${tp.topic}-${tp.partitions.join(',')}`}>
                                        {tp.topic} (Partitions: {tp.partitions.join(', ')})
                                      </div>
                                    ))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {groupOffsets?.offsets && groupOffsets.offsets.length > 0 && (
                      <div className="mt-4">
                        <h5 className="font-medium text-gray-900 mb-2">Topic Offsets</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partition</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offset</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {groupOffsets.offsets.flatMap((topicOffset: TopicOffset) => (
                                topicOffset.partitions.map((partition: PartitionOffset) => (
                                  <tr key={`${topicOffset.topic}-${partition.partition}`}>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{topicOffset.topic}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{partition.partition}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{partition.offset}</td>
                                  </tr>
                                ))
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
