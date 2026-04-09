import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../state/useAuth';

function AppLayout() {
    const { isLoading, user } = useAuth();

    if (isLoading) {
        return null;
    }

    if (!user) {
        return <Redirect href='/(auth)/login' />;
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}

AppLayout.displayName = 'AppLayout';

export { AppLayout };
