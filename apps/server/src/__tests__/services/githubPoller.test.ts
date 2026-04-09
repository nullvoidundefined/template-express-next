import { pollGitHub } from 'app/services/githubPoller.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/config/env.js', () => ({
  env: { GITHUB_TOKEN: 'test-token' },
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const makeResponse = (
  body: unknown,
  headers: Record<string, string> = {},
  ok = true,
  status = 200,
) => ({
  ok,
  status,
  headers: {
    get: (name: string) => headers[name] ?? null,
  },
  json: () => Promise.resolve(body),
  text: () =>
    Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
});

describe('pollGitHub', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns empty data when all requests fail', async () => {
    fetchMock.mockResolvedValue(makeResponse(null, {}, false, 500));
    const data = await pollGitHub('owner', 'repo', 'main');
    expect(data.last_commit_sha).toBeNull();
    expect(data.workflow_status).toBeNull();
  });

  it('populates commit data from GitHub API response', async () => {
    const commitResponse = makeResponse([
      {
        sha: 'abc1234def',
        commit: {
          message: 'Fix bug\n\nDetails here',
          author: { name: 'Jane Doe', date: '2024-01-01T12:00:00Z' },
        },
      },
    ]);
    const runsResponse = makeResponse({ workflow_runs: [] });

    fetchMock
      .mockResolvedValueOnce(commitResponse)
      .mockResolvedValueOnce(runsResponse);

    const data = await pollGitHub('owner', 'repo', 'main');
    expect(data.last_commit_sha).toBe('abc1234');
    expect(data.last_commit_message).toBe('Fix bug');
    expect(data.last_commit_author).toBe('Jane Doe');
    expect(data.last_commit_at).toBe('2024-01-01T12:00:00Z');
  });

  it('populates workflow data from GitHub API response', async () => {
    const commitResponse = makeResponse([]);
    const runsResponse = makeResponse({
      workflow_runs: [
        {
          name: 'CI',
          conclusion: 'success',
          html_url: 'https://github.com/owner/repo/actions/runs/123',
          id: 123,
        },
      ],
    });

    fetchMock
      .mockResolvedValueOnce(commitResponse)
      .mockResolvedValueOnce(runsResponse);

    const data = await pollGitHub('owner', 'repo', 'main');
    expect(data.workflow_name).toBe('CI');
    expect(data.workflow_status).toBe('success');
    expect(data.workflow_run_url).toBe(
      'https://github.com/owner/repo/actions/runs/123',
    );
  });

  it('maps in-progress workflow to pending', async () => {
    const commitResponse = makeResponse([]);
    const runsResponse = makeResponse({
      workflow_runs: [
        {
          name: 'CI',
          conclusion: null,
          status: 'in_progress',
          html_url: 'https://github.com/owner/repo/actions/runs/456',
          id: 456,
        },
      ],
    });

    fetchMock
      .mockResolvedValueOnce(commitResponse)
      .mockResolvedValueOnce(runsResponse);

    const data = await pollGitHub('owner', 'repo', 'main');
    expect(data.workflow_status).toBe('pending');
  });

  it('maps cancelled workflow correctly', async () => {
    const commitResponse = makeResponse([]);
    const runsResponse = makeResponse({
      workflow_runs: [
        {
          name: 'CI',
          conclusion: 'cancelled',
          html_url: 'https://github.com/owner/repo/actions/runs/789',
          id: 789,
        },
      ],
    });

    fetchMock
      .mockResolvedValueOnce(commitResponse)
      .mockResolvedValueOnce(runsResponse);

    const data = await pollGitHub('owner', 'repo', 'main');
    expect(data.workflow_status).toBe('cancelled');
  });

  it('fetches build logs on failure', async () => {
    const commitResponse = makeResponse([]);
    const runsResponse = makeResponse({
      workflow_runs: [
        {
          name: 'CI',
          conclusion: 'failure',
          html_url: 'https://github.com/owner/repo/actions/runs/999',
          id: 999,
        },
      ],
    });
    const logsResponse = makeResponse('Error: build failed\nStep 1\nStep 2');

    fetchMock
      .mockResolvedValueOnce(commitResponse)
      .mockResolvedValueOnce(runsResponse)
      .mockResolvedValueOnce(logsResponse);

    const data = await pollGitHub('owner', 'repo', 'main');
    expect(data.workflow_status).toBe('failure');
    expect(data.build_logs_excerpt).toContain('build failed');
  });

  it('truncates build logs to last 2KB', async () => {
    const commitResponse = makeResponse([]);
    const runsResponse = makeResponse({
      workflow_runs: [
        {
          name: 'CI',
          conclusion: 'failure',
          html_url: 'https://github.com/owner/repo/actions/runs/111',
          id: 111,
        },
      ],
    });
    const largeLogs = 'x'.repeat(10000);
    const logsResponse = makeResponse(largeLogs);

    fetchMock
      .mockResolvedValueOnce(commitResponse)
      .mockResolvedValueOnce(runsResponse)
      .mockResolvedValueOnce(logsResponse);

    const data = await pollGitHub('owner', 'repo', 'main');
    expect(data.build_logs_excerpt?.length).toBe(2048);
  });

  it('skips polling when rate limit nearly exhausted', async () => {
    const commitResponse = makeResponse(
      [
        {
          sha: 'abc',
          commit: {
            message: 'msg',
            author: { name: 'user', date: '2024-01-01' },
          },
        },
      ],
      { 'X-RateLimit-Remaining': '5' },
    );

    fetchMock.mockResolvedValueOnce(commitResponse);

    const data = await pollGitHub('owner', 'repo', 'main');
    // Should return empty (skipped due to rate limit)
    expect(data.last_commit_sha).toBeNull();
    // Only one fetch call was made (rate limit triggered early return)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles network error gracefully', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const data = await pollGitHub('owner', 'repo', 'main');
    expect(data.last_commit_sha).toBeNull();
    expect(data.workflow_status).toBeNull();
  });
});
