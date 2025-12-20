/**
 * Navigation using React Navigation Bottom Tabs
 * Replaced simple state-based navigation with tab navigator
 */

import React from 'react';
import TabNavigator from './TabNavigator';

export type Screen = 'workout' | 'profile' | 'leaderboard' | 'running' | 'map';

function Navigation() {
    return <TabNavigator />;
}

export default Navigation;
