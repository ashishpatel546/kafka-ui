import { NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';

// Define the message structure to fix typing issues
interface KafkaMessage {
  offset: string;
  partition: number;
  key: string | null;
  value: string | null;
  timestamp: string;
}

// Add new interface for incoming message production requests
interface ProduceMessage {
  key: string | null;
  value: string;
  partition?: number;
}

// Use a fixed consumer group ID without instance-specific suffix
// to avoid creating multiple temporary consumer groups
const CONSUMER_GROUP_ID = 'kafka-ui-consumer';

export async function POST(req: Request) {
  try {
    const {
      brokers,
      clientId,
      topic,
      limit = 100,
      readingMode = 'latest',
      search,
      partition,
      offset,
      highestOffsets, // New parameter for tracking message offsets
    } = await req.json();

    if (!brokers || !brokers.length) {
      return NextResponse.json(
        { error: 'Broker information is required' },
        { status: 400 }
      );
    }

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      );
    }

    // Create Kafka client
    const kafka = new Kafka({
      clientId: clientId || 'kafka-ui-admin',
      brokers,
    });

    // Set fromBeginning based on reading mode
    const fromBeginning = readingMode === 'earliest';

    // When in latest mode, we need more precise control
    const useLatestMode = readingMode === 'latest' && !highestOffsets;

    const consumer = kafka.consumer({
      // Use consistent consumer group ID per application instance
      groupId: CONSUMER_GROUP_ID,
      // Allow for clean session semantics - don't commit offsets
      sessionTimeout: 6000,
    });

    await consumer.connect();
    await consumer.subscribe({
      topic,
      fromBeginning: readingMode === 'earliest' || readingMode === 'specific',
    });

    // Fix the type error by providing a proper type definition
    let messages: KafkaMessage[] = [];
    let messageCount = 0;

    // Use the consumer to fetch messages
    const runConsumer = async () => {
      return new Promise<void>(async (resolve, reject) => {
        try {
          // Start the consumer first - as required by KafkaJS
          const runPromise = consumer.run({
            eachMessage: async ({
              message,
              partition: msgPartition,
              topic: msgTopic,
            }) => {
              if (messageCount >= limit) {
                await consumer.stop();
                await consumer.disconnect();
                resolve();
                return;
              }

              const key = message.key ? message.key.toString() : null;
              const value = message.value ? message.value.toString() : null;

              // Filter by search term if provided
              if (
                search &&
                value &&
                !value.toLowerCase().includes(search.toLowerCase())
              ) {
                return;
              }

              // Filter by partition if provided (for non-specific reading mode)
              if (
                readingMode !== 'specific' &&
                partition !== undefined &&
                Number(msgPartition) !== Number(partition)
              ) {
                return;
              }

              // If highestOffsets is provided and this message's offset is not greater
              // than the highest we've seen for this partition, skip it
              if (
                highestOffsets &&
                highestOffsets[msgPartition] !== undefined
              ) {
                const currentOffset = BigInt(message.offset);
                const highestOffset = BigInt(
                  String(highestOffsets[msgPartition])
                ); // Fix TypeScript error

                if (currentOffset <= highestOffset) {
                  return; // Skip messages we've already seen
                }
              }

              messages.push({
                offset: message.offset,
                partition: msgPartition,
                key,
                value,
                timestamp: message.timestamp,
              });

              messageCount++;

              if (messageCount >= limit) {
                await consumer.stop();
                await consumer.disconnect();
                resolve();
              }
            },
          });

          // If specific partition and offset are provided - MUST be after consumer.run() is called
          if (
            readingMode === 'specific' &&
            partition !== undefined &&
            offset !== undefined
          ) {
            // Wait a moment for the consumer group to be registered
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Now seek to the specific offset
            await consumer.seek({
              topic,
              partition: Number(partition),
              offset: String(offset),
            });

            console.log(`Seeking to partition ${partition}, offset ${offset}`);
          }
          // If we have highestOffsets, seek to the next message after each highest offset
          else if (highestOffsets && Object.keys(highestOffsets).length > 0) {
            // Wait a moment for the consumer group to be registered
            await new Promise((resolve) => setTimeout(resolve, 500));

            // For each partition with a highest offset, seek to the next message
            for (const [partitionStr, offsetStr] of Object.entries(
              highestOffsets
            )) {
              const partitionNum = Number(partitionStr);
              // We want to start from the offset after the highest we've seen
              // Fix TypeScript error by ensuring we have a string
              const nextOffset = BigInt(String(offsetStr)) + BigInt(1);

              try {
                await consumer.seek({
                  topic,
                  partition: partitionNum,
                  offset: String(nextOffset),
                });
                console.log(
                  `Seeking to next message in partition ${partitionNum}, offset ${nextOffset}`
                );
              } catch (seekError) {
                console.warn(
                  `Error seeking to offset in partition ${partitionNum}:`,
                  seekError
                );
                // Continue with other partitions if one fails
              }
            }
          }
          // For latest mode with no existing messages, we need to get the latest offsets
          else if (useLatestMode) {
            // For latest mode when we don't have offsets yet, use admin to get partition info
            const admin = kafka.admin();
            await admin.connect();

            try {
              // Wait a moment for the consumer group to be registered
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Get topic offsets to determine the latest ones
              const topicOffsets = await admin.fetchTopicOffsets(topic);
              console.log(`Latest offsets for topic ${topic}:`, topicOffsets);

              // For each partition, seek to the latest offset minus the limit/partitions
              // to get the most recent messages
              const partitionCount = topicOffsets.length;
              const messagesPerPartition = Math.max(
                1,
                Math.ceil(limit / partitionCount)
              );

              for (const topicOffset of topicOffsets) {
                const partitionNum = Number(topicOffset.partition);
                const latestOffset = BigInt(topicOffset.high);

                // Calculate starting offset to get the most recent messages
                // If we have fewer messages than the limit, start from 0 or earliest
                let startOffset = BigInt(0);
                if (latestOffset > BigInt(messagesPerPartition)) {
                  startOffset = latestOffset - BigInt(messagesPerPartition);
                }

                try {
                  await consumer.seek({
                    topic,
                    partition: partitionNum,
                    offset: String(startOffset),
                  });
                  console.log(
                    `Latest mode: Seeking to partition ${partitionNum}, offset ${startOffset} (to get latest messages)`
                  );
                } catch (seekError) {
                  console.warn(
                    `Error seeking to offset in partition ${partitionNum}:`,
                    seekError
                  );
                }
              }
            } finally {
              await admin.disconnect();
            }
          }

          // Set a timeout to stop the consumer after a reasonable time
          setTimeout(async () => {
            try {
              await consumer.stop();
              await consumer.disconnect();
              resolve();
            } catch (err) {
              console.error('Error stopping consumer:', err);
              reject(err);
            }
          }, 5000);
        } catch (error) {
          console.error('Error in consumer run:', error);
          try {
            await consumer.stop();
            await consumer.disconnect();
          } catch (disconnectError) {
            console.error('Error disconnecting consumer:', disconnectError);
          }
          reject(error);
        }
      });
    };

    await runConsumer();

    // Sort messages by timestamp (descending) to ensure latest are first
    messages.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    // Limit the number of messages returned
    if (messages.length > limit) {
      messages = messages.slice(0, limit);
    }

    return NextResponse.json({
      messages,
      topic,
      partitions: Array.from(new Set(messages.map((m) => m.partition))),
    });
  } catch (error: any) {
    console.error('Error fetching Kafka messages:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Kafka messages',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Add PUT method handler for producing messages
export async function PUT(req: Request) {
  try {
    const { brokers, clientId, topic, messages } = await req.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'At least one message is required' },
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

    const producer = kafka.producer();
    await producer.connect();

    try {
      // Format messages for KafkaJS producer
      const kafkaMessages = messages.map((msg: ProduceMessage) => ({
        key: msg.key !== null ? msg.key : undefined,
        value: msg.value,
        partition: msg.partition,
      }));

      // Send messages to Kafka topic
      const result = await producer.send({
        topic,
        messages: kafkaMessages,
      });

      console.log(`Successfully produced messages to ${topic}:`, result);

      return NextResponse.json({
        success: true,
        topic,
        messageCount: messages.length,
      });
    } finally {
      await producer.disconnect();
    }
  } catch (error: any) {
    console.error('Error producing Kafka messages:', error);
    return NextResponse.json(
      {
        error: 'Failed to produce messages',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
