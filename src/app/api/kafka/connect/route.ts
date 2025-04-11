import { NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';

// This is the official way to handle POST requests in Next.js App Router
export async function POST(req: Request) {
  try {
    const { brokers, clientId } = await req.json();

    // Validate the input
    if (!brokers || !Array.isArray(brokers) || brokers.length === 0) {
      return NextResponse.json(
        { error: 'Invalid brokers configuration' },
        { status: 400 }
      );
    }

    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
    }

    // Create Kafka client
    const kafka = new Kafka({
      clientId,
      brokers,
    });

    // Test connection by getting the admin client
    const admin = kafka.admin();
    await admin.connect();

    // Get cluster information
    const clusterInfo = await admin.describeCluster();
    const brokerCount = clusterInfo.brokers.length;

    // Enhanced broker information
    const brokerStatus = await Promise.all(
      clusterInfo.brokers.map(async (broker) => {
        try {
          // For each broker, we'll try to determine if it's the controller
          const isController = broker.nodeId === clusterInfo.controller;

          return {
            nodeId: broker.nodeId,
            host: broker.host,
            port: broker.port,
            isController,
            isActive: true, // If we got this far, the broker is reachable
          };
        } catch (error) {
          console.error(
            `Error checking broker ${broker.nodeId} status:`,
            error
          );
          return {
            nodeId: broker.nodeId,
            host: broker.host,
            port: broker.port,
            isController: false,
            isActive: false,
          };
        }
      })
    );

    await admin.disconnect();

    // Store connection info in session/cookie for future requests
    // In a real app, you might want to store this in a more secure way

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Kafka',
      brokerCount,
      brokerStatus,
      config: { brokers, clientId },
    });
  } catch (error: any) {
    console.error('Error connecting to Kafka:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to Kafka',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
