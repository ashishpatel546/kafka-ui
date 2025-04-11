'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKafka } from '@/contexts/KafkaContext';
import { useState } from 'react';

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
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showInternalGroups, setShowInternalGroups] = useState<boolean>(false);
  
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

  // Mutation for deleting a consumer group
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!connection) throw new Error('No Kafka connection');
      
      // Use force=true for kafka-ui groups
      const useForce = groupId.startsWith('kafka-ui-');
      
      const response = await fetch(`/api/kafka/consumer-groups`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brokers: connection.brokers,
          clientId: connection.clientId,
          groupId,
          force: useForce
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Extract the detailed error message from the response
        throw new Error(data.error ? `${data.error}: ${data.details || ''}` : 'Failed to delete consumer group');
      }
      
      // If there was an error field even with 200 status, still treat it as an error
      if (data.error) {
        throw new Error(`${data.error}: ${data.details || ''}`);
      }
      
      return data;
    },
    onSuccess: () => {
      // Clear any previous error
      setDeleteError(null);
      // Invalidate query to refresh the consumer groups list
      queryClient.invalidateQueries({ queryKey: ['consumer-groups'] });
    },
    onError: (error: Error) => {
      setDeleteError(error.message);
    }
  });

  // Mutation for bulk deleting Kafka UI consumer groups
  const cleanupUiGroupsMutation = useMutation({
    mutationFn: async () => {
      if (!connection) throw new Error('No Kafka connection');
      
      if (!uiGroups || uiGroups.length === 0) {
        throw new Error('No UI consumer groups to clean up');
      }
      
      const promises = uiGroups.map(group => {
        return fetch(`/api/kafka/consumer-groups`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            brokers: connection.brokers,
            clientId: connection.clientId,
            groupId: group.groupId,
            force: true // Always use force for UI groups bulk cleanup
          })
        }).then(resp => resp.json());
      });
      
      return await Promise.all(promises);
    },
    onSuccess: () => {
      // Clear any previous error
      setDeleteError(null);
      // Invalidate query to refresh the consumer groups list
      queryClient.invalidateQueries({ queryKey: ['consumer-groups'] });
    },
    onError: (error: Error) => {
      setDeleteError(error.message);
    }
  });

  const handleDeleteGroup = (groupId: string) => {
    if (window.confirm(`Are you sure you want to delete consumer group "${groupId}"?`)) {
      deleteGroupMutation.mutate(groupId);
    }
  };

  const handleCleanupUiGroups = () => {
    if (uiGroups.length === 0) {
      alert('No Kafka UI consumer groups to clean up.');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete all ${uiGroups.length} Kafka UI consumer groups?`)) {
      cleanupUiGroupsMutation.mutate();
    }
  };

  // Special handler for stubborn consumer groups that won't delete normally
  const handleDeleteStubornGroup = (groupId: string) => {
    if (!connection) return;
    
    if (window.confirm(`Are you sure you want to force delete consumer group "${groupId}"?`)) {
      setDeleteError(null);
      
      // Use the specialRemove parameter for stubborn groups
      fetch(`/api/kafka/consumer-groups`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brokers: connection.brokers,
          clientId: connection.clientId,
          groupId,
          force: true,
          specialRemove: true
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          queryClient.invalidateQueries({ queryKey: ['consumer-groups'] });
        } else if (data.error) {
          setDeleteError(`${data.error}: ${data.details || ''}`);
        }
      })
      .catch(error => {
        setDeleteError(`Error: ${error.message}`);
      });
    }
  };

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

  // Separate consumer groups into regular and Kafka UI internal groups
  const uiGroups = consumerGroups.filter(group => 
    group.groupId.startsWith('kafka-ui-') && group.groupId !== connection?.clientId
  );
  
  const regularGroups = consumerGroups.filter(group => 
    !group.groupId.startsWith('kafka-ui-') && group.groupId !== connection?.clientId
  );

  const displayGroups = showInternalGroups ? uiGroups : regularGroups;

  // Detect stubborn groups - any UI group that has been active for a long time
  // or any group that has failed deletion previously
  const isStubornGroup = (group: ConsumerGroup) => {
    // Consider any kafka-ui group as potentially stubborn
    return group.groupId.startsWith('kafka-ui-');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Consumer Groups</h2>
        <div className="flex gap-4 items-center">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showInternalGroups"
              checked={showInternalGroups}
              onChange={() => setShowInternalGroups(prev => !prev)}
              className="mr-2 h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="showInternalGroups" className="text-sm text-gray-700">
              Show Kafka UI consumer groups ({uiGroups.length})
            </label>
          </div>
          
          {showInternalGroups && uiGroups.length > 0 && (
            <button
              onClick={handleCleanupUiGroups}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-red-400"
              disabled={cleanupUiGroupsMutation.isPending}
            >
              {cleanupUiGroupsMutation.isPending ? 'Cleaning up...' : 'Cleanup All UI Groups'}
            </button>
          )}
        </div>
      </div>
      
      {deleteError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          Error deleting consumer group: {deleteError}
        </div>
      )}
      
      {displayGroups.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {showInternalGroups 
              ? 'No Kafka UI consumer groups found'
              : 'No consumer groups found'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {displayGroups.length} Consumer Group{displayGroups.length !== 1 ? 's' : ''} 
              {showInternalGroups ? ' (Kafka UI Internal)' : ''}
            </h3>
          </div>
          
          <ul className="divide-y divide-gray-200">
            {displayGroups.map((group: ConsumerGroup) => {
              const groupDescription = groupDescriptions.find((g: ConsumerGroup) => g.groupId === group.groupId);
              const groupOffsets = offsetData.find((o: GroupOffset) => o.groupId === group.groupId);
              
              // Check if this is our stubborn consumer group that needs special handling
              const stubborn = isStubornGroup(group);
              
              return (
                <li key={group.groupId} className="px-6 py-5">
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-lg font-semibold">
                        {group.groupId} 
                        {stubborn && <span className="ml-2 text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">Stubborn</span>}
                      </h4>
                      {stubborn ? (
                        <button 
                          onClick={() => handleDeleteStubornGroup(group.groupId)}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                        >
                          Force Remove
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleDeleteGroup(group.groupId)}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          disabled={deleteGroupMutation.isPending}
                        >
                          {deleteGroupMutation.isPending && deleteGroupMutation.variables === group.groupId ? 
                            'Deleting...' : 'Delete Group'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <div className="text-sm text-gray-500">State: <span className="text-gray-900">{groupDescription?.state || 'Unknown'}</span></div>
                        <div className="text-sm text-gray-500">Protocol Type: <span className="text-gray-900">{groupDescription?.protocolType || group.protocolType || 'Unknown'}</span></div>
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
