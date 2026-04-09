import { Stack } from 'expo-router';

function AuthLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}

AuthLayout.displayName = 'AuthLayout';

export { AuthLayout };
