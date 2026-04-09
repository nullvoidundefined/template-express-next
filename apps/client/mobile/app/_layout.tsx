import { Stack } from 'expo-router';

import { QueryProvider } from '../providers/QueryProvider';

function RootLayout() {
    return (
        <QueryProvider>
            <Stack screenOptions={{ headerShown: false }} />
        </QueryProvider>
    );
}

RootLayout.displayName = 'RootLayout';

export { RootLayout };
