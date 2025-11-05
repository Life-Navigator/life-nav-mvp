// API Client - Generated from OpenAPI spec
// TODO: Implement OpenAPI client generation

import axios, { AxiosInstance } from 'axios';

export class LifeNavigatorClient {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey?: string) {
    this.client = axios.create({
      baseURL,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
  }

  // Placeholder methods
  async getUser(userId: string) {
    return this.client.get(`/users/${userId}`);
  }

  async listGoals() {
    return this.client.get('/goals');
  }
}

export default LifeNavigatorClient;
