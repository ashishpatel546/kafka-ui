import { NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';

export async function GET(req: Request) {
  try {
    // In a real application, you would get these from a session/cookie
    // For now, we'll parse them from the URL
    const url = new URL(req.url);
    const brokers = url.searchParams.get('brokers')?.split(',') || ['localhost:9092'];
    const clientId = url.searchParams.get('clientId') || 'kafka-ui-admin';
    
    // Create Kafka client
    const kafka = new Kafka({
      clientId,
      brokers
    });

    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    
    // Get detailed metadata for each topic
    const metadata = await admin.fetchTopicMetadata({ topics });
    
    await admin.disconnect();
    
    return NextResponse.json({ topics: metadata.topics });
  } catch (error: any) {
    console.error('Error listing Kafka topics:', error);
    return NextResponse.json({ 
      error: 'Failed to list Kafka topics', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { brokers, clientId, topic } = await req.json();
    
    if (!topic || !topic.name) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }
    
    // Create Kafka client
    const kafka = new Kafka({
      clientId: clientId || 'kafka-ui-admin',
      brokers: brokers || ['localhost:9092']
    });

    const admin = kafka.admin();
    await admin.connect();
    
    await admin.createTopics({
      topics: [{
        topic: topic.name,
        numPartitions: topic.numPartitions || 1,
        replicationFactor: topic.replicationFactor || 1,
        configEntries: topic.configs?.map((config: {name: string, value: string}) => ({
          name: config.name,
          value: config.value
        })) || []
      }]
    });
    
    await admin.disconnect();
    
    return NextResponse.json({ 
      success: true, 
      message: `Topic "${topic.name}" created successfully` 
    });
  } catch (error: any) {
    console.error('Error creating Kafka topic:', error);
    return NextResponse.json({ 
      error: 'Failed to create Kafka topic', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { brokers, clientId, topicName } = await req.json();
    
    if (!topicName) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }
    
    // Create Kafka client
    const kafka = new Kafka({
      clientId: clientId || 'kafka-ui-admin',
      brokers: brokers || ['localhost:9092']
    });

    const admin = kafka.admin();
    await admin.connect();
    
    await admin.deleteTopics({
      topics: [topicName],
      timeout: 5000
    });
    
    await admin.disconnect();
    
    return NextResponse.json({ 
      success: true, 
      message: `Topic "${topicName}" deleted successfully` 
    });
  } catch (error: any) {
    console.error('Error deleting Kafka topic:', error);
    return NextResponse.json({ 
      error: 'Failed to delete Kafka topic', 
      details: error.message 
    }, { status: 500 });
  }
}
