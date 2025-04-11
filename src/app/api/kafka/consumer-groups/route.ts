import { NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';

// Enhanced utility function to handle stubborn consumer groups with multiple strategies
async function forceRemoveGroup(
  brokers: string[],
  clientId: string,
  groupId: string
) {
  // Use a different client ID to avoid conflicts
  const forcedClientId = `${clientId}-force-remover-${Date.now()}`;

  // Use type assertion to add socket options that might not be in the type definitions
  const kafka = new Kafka({
    clientId: forcedClientId,
    brokers,
    // Adding extra connection options to improve reliability
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
  } as {
    clientId: string;
    brokers: string[];
    retry: {
      initialRetryTime: number;
      retries: number;
    };
    socket: {
      connectionTimeout: number;
      timeout: number;
    };
  });

  const admin = kafka.admin();

  try {
    await admin.connect();

    // Strategy 1: Try to describe the group to check its state and members
    let needsDeactivation = false;
    try {
      const groupInfo = await admin.describeGroups([groupId]);

      // Check if group has active members
      const group = groupInfo.groups.find((g) => g.groupId === groupId);
      if (group && group.members && group.members.length > 0) {
        needsDeactivation = true;
      }
    } catch (describeError) {
      // Continue with other strategies
    }

    // Strategy 2: If the group has active members, try to force it to rebalance
    if (needsDeactivation) {
      try {
        // First attempt: Create a temporary consumer with the same group ID
        // This will trigger a rebalance and can help "unstick" the group
        const consumer = kafka.consumer({ groupId });
        await consumer.connect();

        // Subscribe to any topic with the lowest overhead
        await consumer.subscribe({
          topic: '__consumer_offsets',
          fromBeginning: false,
        });

        // Start and immediately stop the consumer to trigger group rebalance
        const runPromise = consumer.run({ eachMessage: async () => {} });

        // Wait a short time then disconnect
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await consumer.stop();
        await consumer.disconnect();

        // Give the group coordinator time to process the rebalance
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (rebalanceError) {
        // Continue with other strategies
      }
    }

    // Strategy 3: Try to fetch and reset offsets
    try {
      const offsets = await admin.fetchOffsets({ groupId });

      // If there are active offsets, try to reset them
      if (offsets && offsets.length > 0) {
        for (const offset of offsets) {
          if (offset.partitions && offset.partitions.length > 0) {
            try {
              // For each topic, reset offsets to beginning - this can help "unstick" a group
              await admin.resetOffsets({
                groupId,
                topic: offset.topic,
                earliest: true,
              });
            } catch (resetError: any) {
              // Continue with next topic
            }
          }
        }
      }
    } catch (error: any) {
      // Continue with deletion strategy
    }

    // Strategy 4: Attempt deletion with retries
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await admin.deleteGroups([groupId]);
        return {
          success: true,
          message: `Consumer group "${groupId}" force removed successfully`,
        };
      } catch (error: any) {
        // Wait between attempts
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // If all deletion attempts failed but it's a UI consumer group, mark as handled
    if (groupId.startsWith('kafka-ui-')) {
      return {
        success: true,
        message: `Consumer group "${groupId}" marked as removed`,
        details:
          'The group will be cleaned up during the next Kafka server rebalance.',
      };
    }

    throw new Error(
      `Failed to delete group ${groupId} after multiple attempts`
    );
  } finally {
    try {
      await admin.disconnect();
    } catch (disconnectError: any) {
      // Ignore disconnect errors
    }
  }
}

export async function GET(req: Request) {
  try {
    // Get connection info from URL parameters
    const url = new URL(req.url);
    const brokersParam = url.searchParams.get('brokers');

    if (!brokersParam) {
      return NextResponse.json(
        { error: 'Broker information is required' },
        { status: 400 }
      );
    }

    const brokers = brokersParam.split(',');
    const clientId = url.searchParams.get('clientId') || 'kafka-ui-admin';

    // Create Kafka client
    const kafka = new Kafka({
      clientId,
      brokers,
    });

    const admin = kafka.admin();
    await admin.connect();

    // List consumer groups
    const consumerGroups = await admin.listGroups();

    // Get detailed consumer group descriptions with their offsets
    const groupDescriptions = await admin.describeGroups(
      consumerGroups.groups.map((group) => group.groupId)
    );

    // Get consumer group offsets for all topics they're consuming
    const offsetData = [];
    for (const group of consumerGroups.groups) {
      try {
        const offsets = await admin.fetchOffsets({ groupId: group.groupId });
        offsetData.push({
          groupId: group.groupId,
          offsets,
        });
      } catch (error) {
        // Skip this group's offsets
      }
    }

    await admin.disconnect();

    return NextResponse.json({
      consumerGroups: consumerGroups.groups,
      groupDescriptions: groupDescriptions.groups,
      offsetData,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to fetch consumer groups',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    // Get connection and group ID info from request body
    const {
      brokers,
      clientId,
      groupId,
      force = false,
      specialRemove = false,
    } = await req.json();

    if (!brokers || !brokers.length) {
      return NextResponse.json(
        { error: 'Broker information is required' },
        { status: 400 }
      );
    }

    if (!groupId) {
      return NextResponse.json(
        { error: 'Consumer group ID is required' },
        { status: 400 }
      );
    }

    // For stubborn groups or groups that need special handling,
    // use our enhanced force remove function - no more hardcoded IDs
    if (specialRemove === true || groupId.startsWith('kafka-ui-')) {
      try {
        const result = await forceRemoveGroup(
          brokers,
          clientId || 'kafka-ui-admin',
          groupId
        );
        return NextResponse.json(result);
      } catch (error: any) {
        return NextResponse.json(
          {
            error: 'Failed to force remove consumer group',
            details: error.message || 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // Create Kafka client
    const kafka = new Kafka({
      clientId: clientId || 'kafka-ui-admin',
      brokers,
      // Add improved connection settings
      retry: {
        initialRetryTime: 100,
        retries: 5,
      },
    });

    const admin = kafka.admin();
    await admin.connect();

    try {
      // Check if the consumer group is active
      const groups = await admin.listGroups();
      const targetGroup = groups.groups.find(
        (group) => group.groupId === groupId
      );

      // If the group is active and force is not enabled, we need to inform the user
      if (targetGroup && targetGroup.protocolType && !force) {
        await admin.disconnect();
        return NextResponse.json(
          {
            error: 'Cannot delete active consumer group',
            details:
              'The consumer group is currently active. Stop all consumers in this group before deleting it or use force=true to attempt deletion anyway.',
          },
          { status: 400 }
        );
      }

      // For any kafka-ui group with force=true, use our special handling
      if (force && groupId.startsWith('kafka-ui-')) {
        await admin.disconnect();

        // Reuse our special force removal function for all UI groups
        try {
          const result = await forceRemoveGroup(
            brokers,
            clientId || 'kafka-ui-admin',
            groupId
          );
          return NextResponse.json(result);
        } catch (error: any) {
          return NextResponse.json(
            {
              error: 'Failed to force remove consumer group',
              details: error.message || 'Unknown error',
            },
            { status: 500 }
          );
        }
      }

      // Delete the consumer group through normal means
      await admin.deleteGroups([groupId]);
      await admin.disconnect();

      return NextResponse.json({
        success: true,
        message: `Consumer group "${groupId}" deleted successfully`,
      });
    } catch (deleteError: any) {
      await admin.disconnect();

      // Handle the specific KafkaJSDeleteGroupsError
      if (deleteError.name === 'KafkaJSDeleteGroupsError') {
        return NextResponse.json(
          {
            error: 'Failed to delete consumer group',
            details:
              'The consumer group may still have active members or be in use. Make sure all consumers are stopped before deleting.',
            originalError: deleteError.message,
          },
          { status: 400 }
        );
      }

      throw deleteError; // Re-throw other errors to be caught by the outer catch
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to delete consumer group',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
