// Provenance Chain Utilities
import { v4 as uuidv4 } from 'uuid';

export interface ProvenanceRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  metadata?: Record<string, any>;
}

export class ProvenanceChain {
  private records: ProvenanceRecord[] = [];

  addRecord(actor: string, action: string, resource: string, metadata?: Record<string, any>): ProvenanceRecord {
    const record: ProvenanceRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      actor,
      action,
      resource,
      metadata,
    };
    this.records.push(record);
    return record;
  }

  getChain(): ProvenanceRecord[] {
    return [...this.records];
  }

  export(): string {
    return JSON.stringify(this.records, null, 2);
  }
}

export default ProvenanceChain;
