// Root index route. Redirects based on auth state.

import { Redirect } from 'expo-router';

import { useAuth } from '../state/useAuth';

function IndexScreen() {
    const { isLoading, user } = useAuth();

    if (isLoading) {
        return null;
    }

    return <Redirect href={user ? '/(app)/dashboard' : '/(auth)/login'} />;
}

IndexScreen.displayName = 'IndexScreen';

export { IndexScreen };
