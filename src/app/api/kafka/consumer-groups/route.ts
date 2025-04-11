import { NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';

export async function GET(req: Request) {
  try {
    // Get connection info from URL parameters
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
    
    // List consumer groups
    const consumerGroups = await admin.listGroups();
    
    // Get detailed consumer group descriptions with their offsets
    const groupDescriptions = await admin.describeGroups(consumerGroups.groups.map(group => group.groupId));
    
    // Get consumer group offsets for all topics they're consuming
    const offsetData = [];
    for (const group of consumerGroups.groups) {
      try {
        const offsets = await admin.fetchOffsets({ groupId: group.groupId });
        offsetData.push({
          groupId: group.groupId,
          offsets
        });
      } catch (error) {
        console.error(`Error fetching offsets for group ${group.groupId}:`, error);
      }
    }
    
    await admin.disconnect();
    
    return NextResponse.json({
      consumerGroups: consumerGroups.groups,
      groupDescriptions: groupDescriptions.groups,
      offsetData
    });
  } catch (error: any) {
    console.error('Error fetching consumer groups:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch consumer groups', 
      details: error.message 
    }, { status: 500 });
  }
}
