'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

type QueryProviderProps = {
    children: React.ReactNode;
};

function QueryProvider({ children }: QueryProviderProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    mutations: {
                        throwOnError: false,
                    },
                    queries: {
                        retry: false,
                        staleTime: 1000 * 60 * 5, // 5 minutes
                        throwOnError: false,
                    },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

QueryProvider.displayName = 'QueryProvider';

export { QueryProvider };
