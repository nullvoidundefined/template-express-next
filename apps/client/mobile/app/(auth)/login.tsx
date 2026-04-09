import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useAuth } from '../../state/useAuth';

function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');

    const handleSubmit = useCallback(async () => {
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            router.replace('/(app)/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    }, [email, login, password, router]);

    return (
        <View testID='login-screen'>
            <Text>Log in</Text>
            <TextInput
                accessibilityLabel='Email'
                autoCapitalize='none'
                keyboardType='email-address'
                onChangeText={setEmail}
                placeholder='Email'
                testID='email-input'
                value={email}
            />
            <TextInput
                accessibilityLabel='Password'
                onChangeText={setPassword}
                placeholder='Password'
                secureTextEntry
                testID='password-input'
                value={password}
            />
            {error ? <Text accessibilityRole='alert'>{error}</Text> : null}
        </View>
    );
}

LoginScreen.displayName = 'LoginScreen';

export { LoginScreen };
