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

    // Create Kafka client
    const kafka = new Kafka({
      clientId,
      brokers,
    });

    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();

    // Get detailed metadata for each topic
    const metadata = await admin.fetchTopicMetadata({ topics });

    // Enhance topics with metrics
    const topicsWithMetrics = await Promise.all(
      metadata.topics.map(async (topic) => {
        try {
          // Fetch offsets for each topic
          const topicOffsets = await admin.fetchTopicOffsets(topic.name);

          // Calculate total messages by summing the differences between high and low watermarks
          let totalMessages = 0;
          for (const partition of topicOffsets) {
            const low = parseInt(partition.low);
            const high = parseInt(partition.high);
            totalMessages += high - low;
          }

          // Get consumer group lag
          const consumerGroups = await admin.listGroups();
          let totalLag = 0;

          for (const group of consumerGroups.groups) {
            try {
              const offsets = await admin.fetchOffsets({
                groupId: group.groupId,
                topics: [topic.name],
              });

              for (const partitionOffset of offsets[0].partitions) {
                const topicOffset = topicOffsets.find(
                  (to) => to.partition === partitionOffset.partition
                );
                if (topicOffset) {
                  const consumerOffset = parseInt(partitionOffset.offset);
                  const highWatermark = parseInt(topicOffset.high);
                  const partitionLag = Math.max(
                    0,
                    highWatermark - consumerOffset
                  );
                  totalLag += partitionLag;
                }
              }
            } catch (err) {
              // Skip if this consumer group doesn't consume this topic
              continue;
            }
          }

          return {
            ...topic,
            metrics: {
              totalMessages,
              lag: totalLag,
            },
          };
        } catch (err) {
          // If metrics calculation fails, return topic without metrics
          return topic;
        }
      })
    );

    await admin.disconnect();

    return NextResponse.json({ topics: topicsWithMetrics });
  } catch (error: any) {
    console.error('Error listing Kafka topics:', error);
    return NextResponse.json(
      {
        error: 'Failed to list Kafka topics',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { brokers, clientId, topic } = await req.json();

    if (!topic || !topic.name) {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      );
    }

    if (!brokers || !brokers.length) {
      return NextResponse.json(
        { error: 'Broker information is required' },
        { status: 400 }
      );
    }

    // Create Kafka client
    const kafka = new Kafka({
      clientId: clientId || 'kafka-ui-admin',
      brokers,
    });

    const admin = kafka.admin();
    await admin.connect();

    await admin.createTopics({
      topics: [
        {
          topic: topic.name,
          numPartitions: topic.numPartitions || 1,
          replicationFactor: topic.replicationFactor || 1,
          configEntries:
            topic.configs?.map((config: { name: string; value: string }) => ({
              name: config.name,
              value: config.value,
            })) || [],
        },
      ],
    });

    await admin.disconnect();

    return NextResponse.json({
      success: true,
      message: `Topic "${topic.name}" created successfully`,
    });
  } catch (error: any) {
    console.error('Error creating Kafka topic:', error);
    return NextResponse.json(
      {
        error: 'Failed to create Kafka topic',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { brokers, clientId, topicName } = await req.json();

    if (!topicName) {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      );
    }

    if (!brokers || !brokers.length) {
      return NextResponse.json(
        { error: 'Broker information is required' },
        { status: 400 }
      );
    }

    // Create Kafka client
    const kafka = new Kafka({
      clientId: clientId || 'kafka-ui-admin',
      brokers,
    });

    const admin = kafka.admin();
    await admin.connect();

    await admin.deleteTopics({
      topics: [topicName],
      timeout: 5000,
    });

    await admin.disconnect();

    return NextResponse.json({
      success: true,
      message: `Topic "${topicName}" deleted successfully`,
    });
  } catch (error: any) {
    console.error('Error deleting Kafka topic:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete Kafka topic',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
