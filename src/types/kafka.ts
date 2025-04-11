export interface KafkaConnectionConfig {
  brokers: string[];
  clientId: string;
}

export interface KafkaConnection extends KafkaConnectionConfig {
  topics?: string[];
}

export interface TopicConfig {
  name: string;
  value: string;
}

export interface CreateTopicRequest {
  name: string;
  numPartitions: number;
  replicationFactor: number;
  configs?: TopicConfig[];
}

export interface Topic {
  name: string;
  partitions: TopicPartition[];
  metrics?: {
    totalMessages?: number;
    lag?: number;
    consumerGroupLags?: ConsumerGroupLag[];
  };
}

export interface TopicPartition {
  partitionId: number;
  leader: number;
  replicas: number[];
  isr: number[];
}

export interface KafkaMessage {
  offset: string;
  partition: number;
  key: string | null;
  value: string | null;
  timestamp: string;
  headers?: Record<string, string>;
}

export type ReadingMode = 'latest' | 'earliest' | 'specific';

export interface MessageSearchParams {
  topic: string;
  partition?: number;
  offset?: string;
  limit?: number;
  search?: string;
  readingMode: ReadingMode;
  autoRefresh?: boolean;
}

export interface ConsumerGroup {
  groupId: string;
  protocolType: string;
  state: string;
  members: ConsumerGroupMember[];
}

export interface ConsumerGroupMember {
  memberId: string;
  clientId: string;
  clientHost: string;
  assignment: {
    topicPartitions: {
      topic: string;
      partitions: number[];
    }[];
  };
}

export interface ConsumerGroupOffset {
  groupId: string;
  offsets: {
    topic: string;
    partitions: {
      partition: number;
      offset: string;
    }[];
  }[];
}

export interface ConsumerGroupLag {
  groupId: string;
  lag: number;
}
