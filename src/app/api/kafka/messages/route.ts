import { NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';

export async function POST(req: Request) {
  try {
    const { 
      brokers, 
      clientId, 
      topic, 
      partition, 
      offset, 
      limit, 
      search, 
      fromBeginning 
    } = await req.json();
    
    if (!topic) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }
    
    // Create Kafka client
    const kafka = new Kafka({
      clientId: clientId || 'kafka-ui-admin',
      brokers: brokers || ['localhost:9092']
    });

    const admin = kafka.admin();
    await admin.connect();
    
    // Get topic metadata to determine partitions
    const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
    const partitionInfos = metadata.topics[0]?.partitions || [];
    
    // If partition is specified, only get messages from that partition
    const partitionsToQuery = partition !== undefined ? 
      [{ partition }] : 
      partitionInfos.map(p => ({ partition: p.partitionId }));
      
    await admin.disconnect();
    
    // Create consumer to fetch messages
    const consumer = kafka.consumer({ groupId: `kafka-ui-${Date.now()}` });
    await consumer.connect();
    
    // Subscribe to topic
    await consumer.subscribe({ topic, fromBeginning: Boolean(fromBeginning) });
    
    const messages: any[] = [];
    let messagesCount = 0;
    const maxMessages = limit || 100;
    
    // Consume messages
    await new Promise<void>((resolve, reject) => {
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            // Convert message value to string
            const value = message.value?.toString();
            
            // Search functionality
            if (search && value && !value.includes(search)) {
              return;
            }
            
            // Add message to results
            messages.push({
              offset: message.offset,
              partition,
              key: message.key?.toString(),
              value,
              timestamp: message.timestamp,
              headers: message.headers
            });
            
            messagesCount++;
            if (messagesCount >= maxMessages) {
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        }
      });
      
      // Set timeout to prevent hanging if there aren't enough messages
      setTimeout(resolve, 5000);
    });
    
    // Disconnect consumer when done
    await consumer.disconnect();
    
    return NextResponse.json({
      messages,
      topic,
      partitions: partitionInfos.map(p => p.partitionId),
      total: messagesCount
    });
  } catch (error: any) {
    console.error('Error fetching Kafka messages:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch Kafka messages', 
      details: error.message 
    }, { status: 500 });
  }
}
