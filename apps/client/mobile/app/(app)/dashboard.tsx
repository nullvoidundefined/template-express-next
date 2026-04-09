import { Text, View } from 'react-native';

function DashboardScreen() {
    return (
        <View testID='dashboard-screen'>
            <Text>Dashboard</Text>
        </View>
    );
}

DashboardScreen.displayName = 'DashboardScreen';

export { DashboardScreen };
