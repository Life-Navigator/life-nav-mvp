/**
 * Google People API Client
 */

import type { GooglePerson, GoogleContactGroup } from './types';

const PEOPLE_API_BASE = 'https://people.googleapis.com/v1';

export class GooglePeopleClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${PEOPLE_API_BASE}${endpoint}`, {
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
        `People API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  // Default person fields to request
  private readonly defaultPersonFields = [
    'names',
    'emailAddresses',
    'phoneNumbers',
    'photos',
    'organizations',
    'addresses',
    'birthdays',
    'urls',
    'biographies',
    'occupations',
    'relations',
    'userDefined',
  ].join(',');

  // =====================
  // People / Contacts
  // =====================

  /**
   * Get the authenticated user's profile
   */
  async getMe(personFields?: string): Promise<GooglePerson> {
    const fields = personFields || this.defaultPersonFields;
    return this.request<GooglePerson>(`/people/me?personFields=${fields}`);
  }

  /**
   * Get a person by resource name
   */
  async getPerson(
    resourceName: string,
    personFields?: string
  ): Promise<GooglePerson> {
    const fields = personFields || this.defaultPersonFields;
    return this.request<GooglePerson>(`/${resourceName}?personFields=${fields}`);
  }

  /**
   * Get multiple people
   */
  async getBatchGet(
    resourceNames: string[],
    personFields?: string
  ): Promise<{ responses: Array<{ person: GooglePerson }> }> {
    const fields = personFields || this.defaultPersonFields;
    const params = new URLSearchParams();
    resourceNames.forEach((name) => params.append('resourceNames', name));
    params.append('personFields', fields);

    return this.request(`/people:batchGet?${params.toString()}`);
  }

  /**
   * List connections (contacts)
   */
  async listConnections(options?: {
    pageSize?: number;
    pageToken?: string;
    sortOrder?: 'LAST_MODIFIED_ASCENDING' | 'LAST_MODIFIED_DESCENDING' | 'FIRST_NAME_ASCENDING' | 'LAST_NAME_ASCENDING';
    personFields?: string;
    sources?: Array<'READ_SOURCE_TYPE_PROFILE' | 'READ_SOURCE_TYPE_CONTACT' | 'READ_SOURCE_TYPE_DOMAIN_CONTACT'>;
  }): Promise<{
    connections: GooglePerson[];
    nextPageToken?: string;
    totalPeople?: number;
    totalItems?: number;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);
    params.append('personFields', options?.personFields || this.defaultPersonFields);
    if (options?.sources) {
      options.sources.forEach((s) => params.append('sources', s));
    }

    return this.request(`/people/me/connections?${params.toString()}`);
  }

  /**
   * Search contacts
   */
  async searchContacts(
    query: string,
    options?: {
      pageSize?: number;
      readMask?: string;
      sources?: string[];
    }
  ): Promise<{
    results: Array<{ person: GooglePerson }>;
  }> {
    const params = new URLSearchParams();
    params.append('query', query);
    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    params.append('readMask', options?.readMask || this.defaultPersonFields);
    if (options?.sources) {
      options.sources.forEach((s) => params.append('sources', s));
    }

    return this.request(`/people:searchContacts?${params.toString()}`);
  }

  /**
   * Create a contact
   */
  async createContact(contact: {
    names?: Array<{ givenName?: string; familyName?: string }>;
    emailAddresses?: Array<{ value: string; type?: string }>;
    phoneNumbers?: Array<{ value: string; type?: string }>;
    organizations?: Array<{ name?: string; title?: string }>;
    addresses?: Array<{
      streetAddress?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      type?: string;
    }>;
    birthdays?: Array<{ date: { year?: number; month: number; day: number } }>;
    urls?: Array<{ value: string; type?: string }>;
    biographies?: Array<{ value: string }>;
  }): Promise<GooglePerson> {
    return this.request<GooglePerson>(
      `/people:createContact?personFields=${this.defaultPersonFields}`,
      {
        method: 'POST',
        body: JSON.stringify(contact),
      }
    );
  }

  /**
   * Update a contact
   */
  async updateContact(
    resourceName: string,
    contact: Partial<{
      names: Array<{ givenName?: string; familyName?: string }>;
      emailAddresses: Array<{ value: string; type?: string }>;
      phoneNumbers: Array<{ value: string; type?: string }>;
      organizations: Array<{ name?: string; title?: string }>;
      addresses: Array<{
        streetAddress?: string;
        city?: string;
        region?: string;
        postalCode?: string;
        country?: string;
        type?: string;
      }>;
      birthdays: Array<{ date: { year?: number; month: number; day: number } }>;
    }>,
    updatePersonFields: string,
    etag: string
  ): Promise<GooglePerson> {
    return this.request<GooglePerson>(
      `/${resourceName}:updateContact?updatePersonFields=${updatePersonFields}&personFields=${this.defaultPersonFields}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ ...contact, etag }),
      }
    );
  }

  /**
   * Delete a contact
   */
  async deleteContact(resourceName: string): Promise<void> {
    await fetch(`${PEOPLE_API_BASE}/${resourceName}:deleteContact`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // =====================
  // Contact Groups
  // =====================

  /**
   * List contact groups
   */
  async listContactGroups(options?: {
    pageSize?: number;
    pageToken?: string;
    groupFields?: string;
  }): Promise<{
    contactGroups: GoogleContactGroup[];
    nextPageToken?: string;
    totalItems?: number;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.groupFields) params.append('groupFields', options.groupFields);

    return this.request(`/contactGroups?${params.toString()}`);
  }

  /**
   * Get a contact group
   */
  async getContactGroup(
    resourceName: string,
    maxMembers?: number
  ): Promise<GoogleContactGroup & { memberResourceNames?: string[] }> {
    const params = new URLSearchParams();
    if (maxMembers) params.append('maxMembers', maxMembers.toString());

    const queryString = params.toString();
    return this.request(`/${resourceName}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Create a contact group
   */
  async createContactGroup(name: string): Promise<GoogleContactGroup> {
    return this.request<GoogleContactGroup>('/contactGroups', {
      method: 'POST',
      body: JSON.stringify({
        contactGroup: { name },
      }),
    });
  }

  /**
   * Update a contact group
   */
  async updateContactGroup(
    resourceName: string,
    name: string,
    etag: string
  ): Promise<GoogleContactGroup> {
    return this.request<GoogleContactGroup>(`/${resourceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        contactGroup: { name, etag },
      }),
    });
  }

  /**
   * Delete a contact group
   */
  async deleteContactGroup(
    resourceName: string,
    deleteContacts: boolean = false
  ): Promise<void> {
    await fetch(
      `${PEOPLE_API_BASE}/${resourceName}?deleteContacts=${deleteContacts}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
  }

  /**
   * Modify contact group members
   */
  async modifyContactGroupMembers(
    resourceName: string,
    addResourceNames?: string[],
    removeResourceNames?: string[]
  ): Promise<{
    notFoundResourceNames?: string[];
    canNotRemoveLastContactGroupResourceNames?: string[];
  }> {
    return this.request(`/${resourceName}/members:modify`, {
      method: 'POST',
      body: JSON.stringify({
        resourceNamesToAdd: addResourceNames,
        resourceNamesToRemove: removeResourceNames,
      }),
    });
  }

  // =====================
  // Other Contacts
  // =====================

  /**
   * List other contacts (contacts from Gmail, etc.)
   */
  async listOtherContacts(options?: {
    pageSize?: number;
    pageToken?: string;
    readMask?: string;
    requestSyncToken?: boolean;
    syncToken?: string;
    sources?: string[];
  }): Promise<{
    otherContacts: GooglePerson[];
    nextPageToken?: string;
    nextSyncToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    params.append('readMask', options?.readMask || 'names,emailAddresses,phoneNumbers');
    if (options?.requestSyncToken) params.append('requestSyncToken', 'true');
    if (options?.syncToken) params.append('syncToken', options.syncToken);
    if (options?.sources) {
      options.sources.forEach((s) => params.append('sources', s));
    }

    return this.request(`/otherContacts?${params.toString()}`);
  }

  /**
   * Copy other contact to my contacts
   */
  async copyOtherContactToMyContacts(
    resourceName: string,
    copyMask: string = 'names,emailAddresses,phoneNumbers'
  ): Promise<GooglePerson> {
    return this.request<GooglePerson>(`/${resourceName}:copyOtherContactToMyContactsGroup`, {
      method: 'POST',
      body: JSON.stringify({ copyMask }),
    });
  }

  // =====================
  // Directory (Workspace)
  // =====================

  /**
   * List directory people (for Workspace domains)
   */
  async listDirectoryPeople(options?: {
    pageSize?: number;
    pageToken?: string;
    readMask?: string;
    sources: Array<'DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT' | 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'>;
  }): Promise<{
    people: GooglePerson[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    params.append('readMask', options?.readMask || this.defaultPersonFields);
    if (options?.sources) {
      options.sources.forEach((s) => params.append('sources', s));
    }

    return this.request(`/people:listDirectoryPeople?${params.toString()}`);
  }

  /**
   * Search directory people
   */
  async searchDirectoryPeople(
    query: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      readMask?: string;
      sources: Array<'DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT' | 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'>;
    }
  ): Promise<{
    people: GooglePerson[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();
    params.append('query', query);
    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    params.append('readMask', options?.readMask || this.defaultPersonFields);
    if (options?.sources) {
      options.sources.forEach((s) => params.append('sources', s));
    }

    return this.request(`/people:searchDirectoryPeople?${params.toString()}`);
  }

  // =====================
  // Convenience Methods
  // =====================

  /**
   * Get all contacts (handles pagination)
   */
  async getAllContacts(): Promise<GooglePerson[]> {
    const allContacts: GooglePerson[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.listConnections({
        pageSize: 1000,
        pageToken,
      });

      allContacts.push(...(response.connections || []));
      pageToken = response.nextPageToken;
    } while (pageToken);

    return allContacts;
  }

  /**
   * Quick create contact
   */
  async quickCreateContact(
    name: string,
    email?: string,
    phone?: string
  ): Promise<GooglePerson> {
    const nameParts = name.split(' ');
    const givenName = nameParts[0];
    const familyName = nameParts.slice(1).join(' ') || undefined;

    return this.createContact({
      names: [{ givenName, familyName }],
      emailAddresses: email ? [{ value: email }] : undefined,
      phoneNumbers: phone ? [{ value: phone }] : undefined,
    });
  }

  /**
   * Find contact by email
   */
  async findByEmail(email: string): Promise<GooglePerson | null> {
    const results = await this.searchContacts(email);
    return results.results?.[0]?.person || null;
  }

  /**
   * Get contacts with birthdays this month
   */
  async getBirthdaysThisMonth(): Promise<GooglePerson[]> {
    const allContacts = await this.getAllContacts();
    const currentMonth = new Date().getMonth() + 1;

    return allContacts.filter((contact) => {
      const birthday = contact.birthdays?.[0]?.date;
      return birthday && birthday.month === currentMonth;
    });
  }
}

// Factory function
export function createGooglePeopleClient(accessToken: string): GooglePeopleClient {
  return new GooglePeopleClient(accessToken);
}
