/**
 * Google Tasks API Client
 */

import type {
  GoogleTaskList,
  GoogleTask,
  CreateTaskRequest,
  GoogleApiResponse,
} from './types';

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

export class GoogleTasksClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${TASKS_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Tasks API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  // =====================
  // Task Lists
  // =====================

  /**
   * List all task lists
   */
  async listTaskLists(options?: {
    maxResults?: number;
    pageToken?: string;
  }): Promise<GoogleApiResponse<GoogleTaskList[]>> {
    const params = new URLSearchParams();

    if (options?.maxResults) {
      params.append('maxResults', options.maxResults.toString());
    }
    if (options?.pageToken) {
      params.append('pageToken', options.pageToken);
    }

    const queryString = params.toString();
    const data = await this.request<{
      items: GoogleTaskList[];
      nextPageToken?: string;
    }>(`/users/@me/lists${queryString ? `?${queryString}` : ''}`);

    return {
      data: data.items || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get a task list
   */
  async getTaskList(taskListId: string): Promise<GoogleTaskList> {
    return this.request<GoogleTaskList>(`/users/@me/lists/${taskListId}`);
  }

  /**
   * Create a task list
   */
  async createTaskList(title: string): Promise<GoogleTaskList> {
    return this.request<GoogleTaskList>('/users/@me/lists', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * Update a task list
   */
  async updateTaskList(
    taskListId: string,
    title: string
  ): Promise<GoogleTaskList> {
    return this.request<GoogleTaskList>(`/users/@me/lists/${taskListId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * Delete a task list
   */
  async deleteTaskList(taskListId: string): Promise<void> {
    await fetch(`${TASKS_API_BASE}/users/@me/lists/${taskListId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // =====================
  // Tasks
  // =====================

  /**
   * List tasks in a task list
   */
  async listTasks(
    taskListId: string = '@default',
    options?: {
      completedMax?: Date;
      completedMin?: Date;
      dueMax?: Date;
      dueMin?: Date;
      maxResults?: number;
      pageToken?: string;
      showCompleted?: boolean;
      showDeleted?: boolean;
      showHidden?: boolean;
      updatedMin?: Date;
    }
  ): Promise<GoogleApiResponse<GoogleTask[]>> {
    const params = new URLSearchParams();

    if (options?.completedMax) {
      params.append('completedMax', options.completedMax.toISOString());
    }
    if (options?.completedMin) {
      params.append('completedMin', options.completedMin.toISOString());
    }
    if (options?.dueMax) {
      params.append('dueMax', options.dueMax.toISOString());
    }
    if (options?.dueMin) {
      params.append('dueMin', options.dueMin.toISOString());
    }
    if (options?.maxResults) {
      params.append('maxResults', options.maxResults.toString());
    }
    if (options?.pageToken) {
      params.append('pageToken', options.pageToken);
    }
    if (options?.showCompleted !== undefined) {
      params.append('showCompleted', options.showCompleted.toString());
    }
    if (options?.showDeleted !== undefined) {
      params.append('showDeleted', options.showDeleted.toString());
    }
    if (options?.showHidden !== undefined) {
      params.append('showHidden', options.showHidden.toString());
    }
    if (options?.updatedMin) {
      params.append('updatedMin', options.updatedMin.toISOString());
    }

    const queryString = params.toString();
    const data = await this.request<{
      items: GoogleTask[];
      nextPageToken?: string;
    }>(`/lists/${taskListId}/tasks${queryString ? `?${queryString}` : ''}`);

    return {
      data: data.items || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get a task
   */
  async getTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    return this.request<GoogleTask>(`/lists/${taskListId}/tasks/${taskId}`);
  }

  /**
   * Create a task
   */
  async createTask(request: CreateTaskRequest): Promise<GoogleTask> {
    const taskListId = request.taskListId || '@default';

    const taskBody: Record<string, unknown> = {
      title: request.title,
    };

    if (request.notes) taskBody.notes = request.notes;
    if (request.due) taskBody.due = request.due.toISOString();

    const params = new URLSearchParams();
    if (request.parent) {
      params.append('parent', request.parent);
    }

    const queryString = params.toString();
    return this.request<GoogleTask>(
      `/lists/${taskListId}/tasks${queryString ? `?${queryString}` : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(taskBody),
      }
    );
  }

  /**
   * Update a task
   */
  async updateTask(
    taskListId: string,
    taskId: string,
    updates: Partial<{
      title: string;
      notes: string;
      status: 'needsAction' | 'completed';
      due: Date;
    }>
  ): Promise<GoogleTask> {
    const taskBody: Record<string, unknown> = {};

    if (updates.title) taskBody.title = updates.title;
    if (updates.notes !== undefined) taskBody.notes = updates.notes;
    if (updates.status) taskBody.status = updates.status;
    if (updates.due) taskBody.due = updates.due.toISOString();

    return this.request<GoogleTask>(`/lists/${taskListId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(taskBody),
    });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    await fetch(`${TASKS_API_BASE}/lists/${taskListId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * Complete a task
   */
  async completeTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    return this.updateTask(taskListId, taskId, { status: 'completed' });
  }

  /**
   * Uncomplete a task
   */
  async uncompleteTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    return this.updateTask(taskListId, taskId, { status: 'needsAction' });
  }

  /**
   * Move a task to a different position
   */
  async moveTask(
    taskListId: string,
    taskId: string,
    options?: {
      parent?: string;
      previous?: string;
    }
  ): Promise<GoogleTask> {
    const params = new URLSearchParams();
    if (options?.parent) params.append('parent', options.parent);
    if (options?.previous) params.append('previous', options.previous);

    const queryString = params.toString();
    return this.request<GoogleTask>(
      `/lists/${taskListId}/tasks/${taskId}/move${
        queryString ? `?${queryString}` : ''
      }`,
      { method: 'POST' }
    );
  }

  /**
   * Clear completed tasks from a list
   */
  async clearCompleted(taskListId: string): Promise<void> {
    await this.request(`/lists/${taskListId}/clear`, { method: 'POST' });
  }

  // =====================
  // Convenience Methods
  // =====================

  /**
   * Get all tasks from all lists
   */
  async getAllTasks(): Promise<
    Array<{ list: GoogleTaskList; tasks: GoogleTask[] }>
  > {
    const listsResponse = await this.listTaskLists();
    const results: Array<{ list: GoogleTaskList; tasks: GoogleTask[] }> = [];

    for (const list of listsResponse.data) {
      const tasksResponse = await this.listTasks(list.id);
      results.push({
        list,
        tasks: tasksResponse.data,
      });
    }

    return results;
  }

  /**
   * Get tasks due today
   */
  async getTasksDueToday(taskListId: string = '@default'): Promise<GoogleTask[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await this.listTasks(taskListId, {
      dueMin: today,
      dueMax: tomorrow,
      showCompleted: false,
    });

    return response.data;
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(taskListId: string = '@default'): Promise<GoogleTask[]> {
    const now = new Date();

    const response = await this.listTasks(taskListId, {
      dueMax: now,
      showCompleted: false,
    });

    return response.data;
  }

  /**
   * Get upcoming tasks (next 7 days)
   */
  async getUpcomingTasks(
    taskListId: string = '@default',
    days: number = 7
  ): Promise<GoogleTask[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const response = await this.listTasks(taskListId, {
      dueMin: now,
      dueMax: future,
      showCompleted: false,
    });

    return response.data;
  }

  /**
   * Quick add task
   */
  async quickAdd(title: string, due?: Date): Promise<GoogleTask> {
    return this.createTask({ title, due });
  }
}

// Factory function
export function createGoogleTasksClient(accessToken: string): GoogleTasksClient {
  return new GoogleTasksClient(accessToken);
}
