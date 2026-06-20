/** @jest-environment node */

/**
 * Command Center API route wiring + user isolation. The data layer is mocked; these assert each route
 * authenticates, scopes every call to the authed user's id, and routes sends through advisor mode.
 */

const mockAuth = jest.fn();
jest.mock('@/lib/chat/server-auth', () => ({ authedUserId: () => mockAuth() }));

jest.mock('@/lib/chat/store', () => ({
  listProjects: jest.fn(),
  createProject: jest.fn(),
  listThreads: jest.fn(),
  createThread: jest.fn(),
  getMessages: jest.fn(),
}));

const mockSend = jest.fn();
jest.mock('@/lib/chat/send-server', () => ({ sendAdvisorTurn: (a: unknown) => mockSend(a) }));

import * as storeModule from '@/lib/chat/store';
import { GET as projectsGET, POST as projectsPOST } from '@/app/api/chat/projects/route';
import { POST as advisorPOST } from '@/app/api/chat/advisor/route';
import {
  GET as messagesGET,
  POST as messagesPOST,
} from '@/app/api/chat/threads/[id]/messages/route';

const mockStore = storeModule as unknown as Record<string, jest.Mock>;

function req(body: unknown, search = '') {
  return {
    json: async () => body,
    nextUrl: { searchParams: new URLSearchParams(search) },
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue('user-1');
});

it('projects GET is 401 without a session', async () => {
  mockAuth.mockResolvedValue(null);
  const res = await projectsGET();
  expect(res.status).toBe(401);
});

it('projects GET returns the caller’s projects (scoped by user id)', async () => {
  mockStore.listProjects.mockResolvedValue([{ id: 'p1', name: 'MBA Decision' }]);
  const res = await projectsGET();
  expect(res.status).toBe(200);
  expect(mockStore.listProjects).toHaveBeenCalledWith('user-1');
  expect((await res.json()).projects).toHaveLength(1);
});

it('projects POST creates a project for the authed user', async () => {
  mockStore.createProject.mockResolvedValue({ id: 'p2', name: 'House' });
  const res = await projectsPOST(req({ name: 'House' }));
  expect(res.status).toBe(201);
  expect(mockStore.createProject).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ name: 'House' })
  );
});

it('advisor POST mints a thread, sends in advisor mode, returns thread_id', async () => {
  mockStore.createThread.mockResolvedValue({ id: 't-new' });
  mockSend.mockResolvedValue({
    status: 200,
    assistant_message: 'hi',
    citations: [],
    agent: 'career_advisor',
  });
  const res = await advisorPOST(req({ message: 'Am I ready?', agent: 'career_advisor' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.thread_id).toBe('t-new');
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'user-1', threadId: 't-new', agent: 'career_advisor' })
  );
});

it('advisor POST rejects an empty message', async () => {
  const res = await advisorPOST(req({ message: '   ' }));
  expect(res.status).toBe(400);
});

it('messages GET is scoped to the caller + thread', async () => {
  mockStore.getMessages.mockResolvedValue([{ id: 'm1', role: 'user', content: 'hi' }]);
  const res = await messagesGET(req({}), { params: Promise.resolve({ id: 't1' }) });
  expect(mockStore.getMessages).toHaveBeenCalledWith('user-1', 't1');
  expect((await res.json()).messages).toHaveLength(1);
});

it('messages POST sends the turn in the thread', async () => {
  mockSend.mockResolvedValue({ status: 200, assistant_message: 'ok', citations: [], agent: null });
  const res = await messagesPOST(req({ message: 'hello' }), {
    params: Promise.resolve({ id: 't1' }),
  });
  expect(res.status).toBe(200);
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'user-1', threadId: 't1', message: 'hello' })
  );
});
