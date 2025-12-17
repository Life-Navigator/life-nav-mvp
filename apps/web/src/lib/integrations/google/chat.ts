/**
 * Google Chat API Client
 */

import type { GoogleChatSpace, GoogleChatMessage } from './types';

const CHAT_API_BASE = 'https://chat.googleapis.com/v1';

export class GoogleChatClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${CHAT_API_BASE}${endpoint}`, {
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
        `Chat API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  // =====================
  // Spaces
  // =====================

  /**
   * List spaces the caller is a member of
   */
  async listSpaces(options?: {
    pageSize?: number;
    pageToken?: string;
    filter?: string;
  }): Promise<{
    spaces: GoogleChatSpace[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.filter) params.append('filter', options.filter);

    const queryString = params.toString();
    return this.request(`/spaces${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a space
   */
  async getSpace(spaceName: string): Promise<GoogleChatSpace> {
    return this.request<GoogleChatSpace>(`/${spaceName}`);
  }

  /**
   * Create a space
   */
  async createSpace(
    displayName: string,
    spaceType: 'SPACE' | 'GROUP_CHAT' = 'SPACE',
    options?: {
      description?: string;
      guidelines?: string;
      externalUserAllowed?: boolean;
    }
  ): Promise<GoogleChatSpace> {
    const body: Record<string, unknown> = {
      displayName,
      spaceType,
    };

    if (options?.description || options?.guidelines) {
      body.spaceDetails = {
        description: options.description,
        guidelines: options.guidelines,
      };
    }

    if (options?.externalUserAllowed !== undefined) {
      body.externalUserAllowed = options.externalUserAllowed;
    }

    return this.request<GoogleChatSpace>('/spaces', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Update a space
   */
  async updateSpace(
    spaceName: string,
    updates: {
      displayName?: string;
      description?: string;
      guidelines?: string;
    },
    updateMask: string[]
  ): Promise<GoogleChatSpace> {
    const body: Record<string, unknown> = {};

    if (updates.displayName) body.displayName = updates.displayName;
    if (updates.description || updates.guidelines) {
      body.spaceDetails = {
        description: updates.description,
        guidelines: updates.guidelines,
      };
    }

    return this.request<GoogleChatSpace>(
      `/${spaceName}?updateMask=${updateMask.join(',')}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Delete a space
   */
  async deleteSpace(spaceName: string): Promise<void> {
    await fetch(`${CHAT_API_BASE}/${spaceName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // =====================
  // Messages
  // =====================

  /**
   * List messages in a space
   */
  async listMessages(
    spaceName: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      filter?: string;
      orderBy?: string;
      showDeleted?: boolean;
    }
  ): Promise<{
    messages: GoogleChatMessage[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.filter) params.append('filter', options.filter);
    if (options?.orderBy) params.append('orderBy', options.orderBy);
    if (options?.showDeleted !== undefined) {
      params.append('showDeleted', options.showDeleted.toString());
    }

    const queryString = params.toString();
    return this.request(
      `/${spaceName}/messages${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Get a message
   */
  async getMessage(messageName: string): Promise<GoogleChatMessage> {
    return this.request<GoogleChatMessage>(`/${messageName}`);
  }

  /**
   * Create a message in a space
   */
  async createMessage(
    spaceName: string,
    content: {
      text?: string;
      cards?: object[];
      cardsV2?: object[];
      accessoryWidgets?: object[];
    },
    options?: {
      threadKey?: string;
      requestId?: string;
      messageReplyOption?: 'MESSAGE_REPLY_OPTION_UNSPECIFIED' | 'REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD' | 'REPLY_MESSAGE_OR_FAIL';
    }
  ): Promise<GoogleChatMessage> {
    const params = new URLSearchParams();

    if (options?.threadKey) params.append('threadKey', options.threadKey);
    if (options?.requestId) params.append('requestId', options.requestId);
    if (options?.messageReplyOption) {
      params.append('messageReplyOption', options.messageReplyOption);
    }

    const queryString = params.toString();
    return this.request<GoogleChatMessage>(
      `/${spaceName}/messages${queryString ? `?${queryString}` : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(content),
      }
    );
  }

  /**
   * Update a message
   */
  async updateMessage(
    messageName: string,
    content: {
      text?: string;
      cards?: object[];
      cardsV2?: object[];
    },
    updateMask: string[]
  ): Promise<GoogleChatMessage> {
    return this.request<GoogleChatMessage>(
      `/${messageName}?updateMask=${updateMask.join(',')}`,
      {
        method: 'PATCH',
        body: JSON.stringify(content),
      }
    );
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageName: string): Promise<void> {
    await fetch(`${CHAT_API_BASE}/${messageName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // =====================
  // Members
  // =====================

  /**
   * List members in a space
   */
  async listMembers(
    spaceName: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      filter?: string;
      showGroups?: boolean;
      showInvited?: boolean;
    }
  ): Promise<{
    memberships: Array<{
      name: string;
      state: 'JOINED' | 'INVITED' | 'NOT_A_MEMBER';
      role: 'ROLE_MEMBER' | 'ROLE_MANAGER';
      member?: {
        name: string;
        displayName: string;
        type: 'HUMAN' | 'BOT';
      };
      groupMember?: {
        name: string;
      };
      createTime: string;
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.filter) params.append('filter', options.filter);
    if (options?.showGroups !== undefined) {
      params.append('showGroups', options.showGroups.toString());
    }
    if (options?.showInvited !== undefined) {
      params.append('showInvited', options.showInvited.toString());
    }

    const queryString = params.toString();
    return this.request(
      `/${spaceName}/members${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Get a member
   */
  async getMember(membershipName: string): Promise<{
    name: string;
    state: string;
    role: string;
    member?: object;
  }> {
    return this.request(`/${membershipName}`);
  }

  /**
   * Create a membership (add member to space)
   */
  async createMember(
    spaceName: string,
    member: {
      member?: { name: string; type?: 'HUMAN' | 'BOT' };
      groupMember?: { name: string };
    },
    role: 'ROLE_MEMBER' | 'ROLE_MANAGER' = 'ROLE_MEMBER'
  ): Promise<{
    name: string;
    state: string;
    role: string;
  }> {
    return this.request(`/${spaceName}/members`, {
      method: 'POST',
      body: JSON.stringify({ ...member, role }),
    });
  }

  /**
   * Delete a membership (remove member from space)
   */
  async deleteMember(membershipName: string): Promise<void> {
    await fetch(`${CHAT_API_BASE}/${membershipName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // =====================
  // Reactions
  // =====================

  /**
   * Create a reaction on a message
   */
  async createReaction(
    messageName: string,
    emoji: { unicode?: string; customEmoji?: { uid: string } }
  ): Promise<{
    name: string;
    user: object;
    emoji: object;
  }> {
    return this.request(`/${messageName}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  /**
   * List reactions on a message
   */
  async listReactions(
    messageName: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      filter?: string;
    }
  ): Promise<{
    reactions: Array<{
      name: string;
      user: object;
      emoji: { unicode?: string };
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.filter) params.append('filter', options.filter);

    const queryString = params.toString();
    return this.request(
      `/${messageName}/reactions${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Delete a reaction
   */
  async deleteReaction(reactionName: string): Promise<void> {
    await fetch(`${CHAT_API_BASE}/${reactionName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // =====================
  // Convenience Methods
  // =====================

  /**
   * Send a simple text message
   */
  async sendMessage(spaceName: string, text: string): Promise<GoogleChatMessage> {
    return this.createMessage(spaceName, { text });
  }

  /**
   * Reply to a thread
   */
  async replyToThread(
    spaceName: string,
    threadKey: string,
    text: string
  ): Promise<GoogleChatMessage> {
    return this.createMessage(spaceName, { text }, { threadKey });
  }

  /**
   * Send a card message
   */
  async sendCard(
    spaceName: string,
    card: {
      header?: {
        title: string;
        subtitle?: string;
        imageUrl?: string;
        imageType?: 'SQUARE' | 'CIRCLE';
      };
      sections: Array<{
        header?: string;
        widgets: object[];
        collapsible?: boolean;
        uncollapsibleWidgetsCount?: number;
      }>;
    }
  ): Promise<GoogleChatMessage> {
    return this.createMessage(spaceName, {
      cardsV2: [
        {
          cardId: crypto.randomUUID(),
          card,
        },
      ],
    });
  }

  /**
   * Find or create a DM with a user
   */
  async findOrCreateDM(userId: string): Promise<GoogleChatSpace> {
    // First try to find existing DM
    const spaces = await this.listSpaces({
      filter: `spaceType = "DIRECT_MESSAGE" AND singleUserBotDm = false`,
    });

    for (const space of spaces.spaces) {
      const members = await this.listMembers(space.name);
      const hasUser = members.memberships.some(
        (m) => m.member?.name === `users/${userId}`
      );
      if (hasUser && members.memberships.length === 2) {
        return space;
      }
    }

    // Create new DM space
    return this.request('/spaces:setup', {
      method: 'POST',
      body: JSON.stringify({
        space: {
          spaceType: 'DIRECT_MESSAGE',
        },
        memberships: [
          { member: { name: `users/${userId}`, type: 'HUMAN' } },
        ],
      }),
    });
  }
}

// Factory function
export function createGoogleChatClient(accessToken: string): GoogleChatClient {
  return new GoogleChatClient(accessToken);
}

// Card builder helpers
export const ChatCardWidgets = {
  textParagraph: (text: string) => ({
    textParagraph: { text },
  }),

  decoratedText: (options: {
    topLabel?: string;
    text: string;
    bottomLabel?: string;
    icon?: string;
    button?: { text: string; onClick: object };
  }) => ({
    decoratedText: {
      topLabel: options.topLabel,
      text: options.text,
      bottomLabel: options.bottomLabel,
      startIcon: options.icon ? { knownIcon: options.icon } : undefined,
      button: options.button,
    },
  }),

  buttonList: (buttons: Array<{ text: string; onClick: object }>) => ({
    buttonList: {
      buttons: buttons.map((b) => ({
        text: b.text,
        onClick: b.onClick,
      })),
    },
  }),

  image: (imageUrl: string, altText?: string) => ({
    image: { imageUrl, altText },
  }),

  divider: () => ({ divider: {} }),

  textInput: (name: string, label: string, options?: {
    hintText?: string;
    value?: string;
    type?: 'SINGLE_LINE' | 'MULTIPLE_LINE';
  }) => ({
    textInput: {
      name,
      label,
      ...options,
    },
  }),

  selectionInput: (
    name: string,
    label: string,
    type: 'CHECK_BOX' | 'RADIO_BUTTON' | 'SWITCH' | 'DROPDOWN' | 'MULTI_SELECT',
    items: Array<{ text: string; value: string; selected?: boolean }>
  ) => ({
    selectionInput: {
      name,
      label,
      type,
      items,
    },
  }),

  dateTimePicker: (
    name: string,
    label: string,
    type: 'DATE_AND_TIME' | 'DATE_ONLY' | 'TIME_ONLY'
  ) => ({
    dateTimePicker: {
      name,
      label,
      type,
    },
  }),
};
