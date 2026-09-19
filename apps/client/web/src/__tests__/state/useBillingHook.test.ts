import { createElement } from 'react';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type * as ApiServiceModule from '@/services/apiService';
import { ApiError, api } from '@/services/apiService';
import { useBilling } from '@/state/useBillingHook';

// Only the network call is replaced; ApiError stays real so the hook can be
// checked for rejecting with the error the API service throws.
vi.mock('@/services/apiService', async (importOriginal) => {
  const original = await importOriginal<typeof ApiServiceModule>();
  return { ...original, api: vi.fn() };
});

type RequestOptions = { body?: unknown; method?: string };

const CHECKOUT_URL = 'https://checkout.stripe.test/session';
const PORTAL_URL = 'https://billing.stripe.test/portal';

const mockedApi = vi.mocked(api);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// Answers like the real service: { data: { url } }, parsed by the caller's
// schema when one is passed.
function respondWithUrl(url: string) {
  mockedApi.mockImplementation(((_path: string, schemaOrOpts?: unknown) => {
    const payload = { data: { url } };
    return Promise.resolve(
      schemaOrOpts instanceof z.ZodType ? schemaOrOpts.parse(payload) : payload,
    );
  }) as typeof api);
}

function respondAfter(gate: Promise<void>, url: string) {
  mockedApi.mockImplementation((async (
    _path: string,
    schemaOrOpts?: unknown,
  ) => {
    await gate;
    const payload = { data: { url } };
    return schemaOrOpts instanceof z.ZodType
      ? schemaOrOpts.parse(payload)
      : payload;
  }) as typeof api);
}

function findRequestOptions(path: string): RequestOptions | undefined {
  const calls = mockedApi.mock.calls as unknown[][];
  const call = calls.find(([calledPath]) => calledPath === path);
  return call
    ?.slice(1)
    .find(
      (arg): arg is RequestOptions =>
        typeof arg === 'object' && arg !== null && 'method' in arg,
    );
}

function createGate() {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { gate, open };
}

describe('useBilling', () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it('startCheckout posts an empty body to /billing/checkout and resolves to the URL (C-1)', async () => {
    respondWithUrl(CHECKOUT_URL);
    const { result } = renderHook(() => useBilling(), {
      wrapper: createWrapper(),
    });

    let url = '';
    await act(async () => {
      url = await result.current.startCheckout();
    });

    expect(url).toBe(CHECKOUT_URL);
    expect(findRequestOptions('/billing/checkout')).toEqual({
      body: {},
      method: 'POST',
    });
  });

  it('openPortal posts to /billing/portal and resolves to the URL (C-2)', async () => {
    respondWithUrl(PORTAL_URL);
    const { result } = renderHook(() => useBilling(), {
      wrapper: createWrapper(),
    });

    let url = '';
    await act(async () => {
      url = await result.current.openPortal();
    });

    expect(url).toBe(PORTAL_URL);
    expect(findRequestOptions('/billing/portal')?.method).toBe('POST');
  });

  it('reports checkout as pending until the request settles (C-3)', async () => {
    const { gate, open } = createGate();
    respondAfter(gate, CHECKOUT_URL);
    const { result } = renderHook(() => useBilling(), {
      wrapper: createWrapper(),
    });

    let pendingCheckout: Promise<string> = Promise.resolve('');
    act(() => {
      pendingCheckout = result.current.startCheckout();
    });

    await waitFor(() => {
      expect(result.current.isCheckoutPending).toBe(true);
    });
    expect(result.current.isPortalPending).toBe(false);

    await act(async () => {
      open();
      await pendingCheckout;
    });

    await waitFor(() => {
      expect(result.current.isCheckoutPending).toBe(false);
    });
  });

  it('reports the portal as pending until the request settles (C-3)', async () => {
    const { gate, open } = createGate();
    respondAfter(gate, PORTAL_URL);
    const { result } = renderHook(() => useBilling(), {
      wrapper: createWrapper(),
    });

    let pendingPortal: Promise<string> = Promise.resolve('');
    act(() => {
      pendingPortal = result.current.openPortal();
    });

    await waitFor(() => {
      expect(result.current.isPortalPending).toBe(true);
    });
    expect(result.current.isCheckoutPending).toBe(false);

    await act(async () => {
      open();
      await pendingPortal;
    });

    await waitFor(() => {
      expect(result.current.isPortalPending).toBe(false);
    });
  });

  it('rejects openPortal with the ApiError from the service (C-4)', async () => {
    const noAccount = new ApiError(
      400,
      'No billing account found',
      'BILLING_NO_ACCOUNT',
    );
    mockedApi.mockRejectedValue(noAccount);
    const { result } = renderHook(() => useBilling(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.openPortal()).rejects.toBe(noAccount);
    });
  });

  it('rejects startCheckout with the ApiError from the service (C-4)', async () => {
    const notConfigured = new ApiError(
      503,
      'Billing is not configured',
      'BILLING_NOT_CONFIGURED',
    );
    mockedApi.mockRejectedValue(notConfigured);
    const { result } = renderHook(() => useBilling(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.startCheckout()).rejects.toBe(notConfigured);
    });
  });
});
