import { NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';

export async function GET(req: Request) {
  try {
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
    const topicName = url.searchParams.get('topic');

    if (!topicName) {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      );
    }

    // Create Kafka client
    const kafka = new Kafka({
      clientId,
      brokers,
    });

    const admin = kafka.admin();
    await admin.connect();

    // Fetch offsets for the topic
    const topicOffsets = await admin.fetchTopicOffsets(topicName);

    // Calculate total messages by summing the differences between high and low watermarks
    let totalMessages = 0;
    for (const partition of topicOffsets) {
      const low = parseInt(partition.low);
      const high = parseInt(partition.high);
      totalMessages += high - low;
    }

    // Get all consumer groups
    const consumerGroups = await admin.listGroups();

    // Calculate lag for each consumer group that consumes this topic
    const consumerGroupLags = [];

    // If we found consumer groups, calculate the lag for each
    if (consumerGroups.groups.length > 0) {
      for (const group of consumerGroups.groups) {
        try {
          // Skip empty groups
          if (!group.groupId) continue;

          // Fetch offsets for this group for the specified topic
          const offsets = await admin.fetchOffsets({
            groupId: group.groupId,
            topics: [topicName], // Fix: Using 'topics' array instead of 'topic'
          });

          // Check if this consumer group has data for our topic
          const topicOffsetData = offsets.find(
            (offsetData) => offsetData.topic === topicName
          );
          if (!topicOffsetData) continue;

          // Calculate lag for this consumer group
          let groupLag = 0;
          let isConsumingTopic = false;

          for (const partitionData of topicOffsetData.partitions) {
            // Skip partitions with no offset committed (-1 means no offset)
            if (partitionData.offset === '-1') continue;

            // Find the corresponding partition offset from topic offsets
            const topicOffset = topicOffsets.find(
              (to) => to.partition === partitionData.partition
            );

            if (topicOffset) {
              isConsumingTopic = true;
              const consumerOffset = parseInt(partitionData.offset) || 0;
              const highWatermark = parseInt(topicOffset.high) || 0;
              const partitionLag = Math.max(0, highWatermark - consumerOffset);
              groupLag += partitionLag;
            }
          }

          // Only add groups that are actually consuming this topic
          if (isConsumingTopic) {
            consumerGroupLags.push({
              groupId: group.groupId,
              lag: groupLag,
            });
          }
        } catch (err) {
          console.error(
            `Error getting offsets for group ${group.groupId}:`,
            err
          );
          continue;
        }
      }
    }

    // Calculate total lag across all consumer groups
    // If no consumer groups are consuming this topic, lag equals total messages
    const totalLag =
      consumerGroupLags.length > 0
        ? Math.max(...consumerGroupLags.map((g) => g.lag))
        : totalMessages;

    await admin.disconnect();

    return NextResponse.json({
      topic: topicName,
      metrics: {
        totalMessages,
        lag: totalLag,
        consumerGroupLags,
      },
    });
  } catch (error: any) {
    console.error('Error fetching topic metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch topic metrics',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
