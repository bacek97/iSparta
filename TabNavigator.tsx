import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, G, Defs, Circle, Ellipse, Text as SvgText, TSpan, Use } from 'react-native-svg';

import WorkoutScreen from './WorkoutScreen';
import ProfileScreen from './ProfileScreen';
import LeaderboardScreen from './LeaderboardScreen';
import RunningMapScreen from './RunningMapScreen';
import MapScreen from './MapScreen';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator();

// SVG Icon Components
const HomeIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 49.4 94.3">
        <Path fill={color} d="m27.2 42.8 1.9.3v-7.8q0-2.1 1.9-3.2-.6-.7-1.6-.7-2 .2-2.2 2.3z" />
        <Path fill={color} d="M29.5 35.3v7.9l12.5 2v-7.7q.1-1.8 1.7-2.5a3 3 0 0 0-2.1-1.4l-8.4-1.4c-2-.5-3.7 1.1-3.7 3.1" />
        <Path fill={color} d="M46.8 37.4c0-1.2-1-2.3-2.2-2.3s-2.2 1-2.2 2.3v7.8l4.4.7z" />
        <Path fill={color} d="M48.1 46.7V5.4L24.6 1.5v41.4Zm1.3-42.4v44L23.3 44V0Z" />
    </Svg>
);

const RunningIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="-5 -10 72 96.9">
        <G fill={color}>
            <Path d="M29.2 86.9h-30q-3.5-.2-4.1-3.2c-.4-2 .8-4 3-4.8l15-6.5c2.7-1.3 4.2-2.9 3.6-6.7l-6.6-38.6q-1.9-8.9 3.4-14.9c8-9.6 19.7-17.7 32-22.1a1.6 1.6 0 1 1 1 3C34.7-2.8 23.5 5 16 14.1c-3 3.4-3.8 7.2-2.8 12.3l6.7 38.7c1 6.2-2.5 8.6-5.5 10L-.8 81.8q-1.2.7-1 1.3t1 .6h30c2.5-.3 3-1.5 3-3.3q0-1.5-.5-3.7c-.7-3.4-1.5-7.6.4-12.3 3.7-9.2 4.2-26.3-.8-33.7a1.6 1.6 0 0 1 1-2.4C43.6 25.7 58.4 19.5 64 5.1a1.6 1.6 0 0 1 2.9 1.1C61 21.7 45.2 28.2 35 31c4.9 9.5 3.5 26.1 0 34.6-1.5 3.9-.8 7.5-.2 10.6q.5 2.4.5 4.3c0 2.6-1 5.8-5.9 6.5z" />
        </G>
    </Svg>
);

const MapIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path
            fill={color}
            d="M20 10 L40 20 L60 10 L80 20 L80 90 L60 80 L40 90 L20 80 Z M40 25 L40 85 M60 15 L60 75"
            stroke={color}
            strokeWidth="2"
        />
    </Svg>
);

const LeaderboardIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path
            fill={color}
            d="M20 80 L20 50 L35 50 L35 80 Z M42.5 80 L42.5 30 L57.5 30 L57.5 80 Z M65 80 L65 40 L80 40 L80 80 Z"
        />
        <Circle cx="50" cy="15" r="8" fill={color} />
    </Svg>
);

const ProfileIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="-5 -10 96.9 93.6">
        <G fill={color}>
            <Path d="M89.3 69.4C64.2 88.8 27.5 80 4.1 63.8c-6-4.1-7.2-8.8-4.8-17L9.7 11C13.2-.3 17-7 26-7h13.6c4 0 7.6 8.2 7.6 14.6q0 2.6-.8 4-.7 1.3-1.9 1.2H42c1.2-3 .5-7.4-.8-10.9a1.6 1.6 0 1 0-3 1.2c1.5 3.6 1.7 7.6.6 9.2q-.3.6-1 .5h-3.3c1.1-3 .4-7.4-.9-10.9a1.6 1.6 0 0 0-3 1.1c1.5 3.7 1.7 7.7.7 9.3q-.4.6-1 .5H29c-2.5.2-4.5.2-7-3.2a1.6 1.6 0 0 0-2.5 1.8c2.9 4.1 6 4.6 8.4 4.6h1.7c.2 4.8.3 14.9-.4 20.1A26 26 0 0 0 20 46.4a1.6 1.6 0 0 0 2.8 1.4c3-6.2 9.3-11 16.4-12.4 5.4-1 13.6-.7 22.4 7q3.7 3.6 5 7.8a1.6 1.6 0 1 0 3-.8c-1-3.5-3-6.4-4.7-8.2 4-3.5 14.7-11.6 24.4-3.7a1.6 1.6 0 0 0 2-2.5c-9.6-7.7-21.2-2.8-28.7 4-7.3-5.9-15.8-8.3-24-6.6q-3.1.5-6 2c.4-5.7.3-14 .2-18.3h11.7q3 0 4.6-2.8 1.2-2.2 1.2-5.7C50.3.4 46.2-10 39.6-10H26C14-10 9.8-.1 6.7 10L-3.7 46c-2.8 9.6-1 15.5 6 20.5a95 95 0 0 0 52.4 17.2c13 0 25.8-3.4 36.6-11.8a1.6 1.6 0 1 0-2-2.4" />
        </G>
    </Svg>
);

const SettingsIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
            fill={color}
            d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
        />
    </Svg>
);

export type TabParamList = {
    Home: undefined;
    Running: undefined;
    Map: undefined;
    Leaderboard: undefined;
    Profile: undefined;
    Settings: undefined;
};

function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    const iconSize = size || 24;
                    const iconColor = focused ? '#FF14A7' : color;

                    switch (route.name) {
                        case 'Home':
                            return <HomeIcon color={iconColor} size={iconSize} />;
                        case 'Running':
                            return <RunningIcon color={iconColor} size={iconSize} />;
                        case 'Map':
                            return <MapIcon color={iconColor} size={iconSize} />;
                        case 'Leaderboard':
                            return <LeaderboardIcon color={iconColor} size={iconSize} />;
                        case 'Profile':
                            return <ProfileIcon color={iconColor} size={iconSize} />;
                        case 'Settings':
                            return <SettingsIcon color={iconColor} size={iconSize} />;
                        default:
                            return null;
                    }
                },
                tabBarActiveTintColor: '#FF14A7',
                tabBarInactiveTintColor: '#8E8E93',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabBarLabel,
                headerShown: false,
                tabBarShowLabel: true,
            })}
        >
            <Tab.Screen
                name="Home"
                component={WorkoutScreen}
                initialParams={{ onNavigateToProfile: undefined }}
            />
            <Tab.Screen name="Running" component={RunningMapScreen} />
            <Tab.Screen name="Map" component={MapScreen} />
            <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#1C1C1E',
        borderTopColor: '#38383A',
        borderTopWidth: 1,
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
    },
    tabBarLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
});

export default TabNavigator;
