import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { composeStories } from '@storybook/react';

import * as stories from '../components/ExampleScreen.stories';

// Compile the 'Default' and 'CustomContent' stories from ExampleScreen.stories.tsx
const { Default, CustomContent } = composeStories(stories);

describe('ExampleScreen Component (Powered by Storybook)', () => {

    it('renders the Default story with initial props and handles press', () => {
        // We add a mock function to test interaction
        const onPressMock = jest.fn();

        // Render the Story component directly!
        // It automatically receives the `args` we defined in ExampleScreen.stories.tsx
        // (title: 'Welcome to iSparta', description: 'This is an example...', buttonText: 'Get Started')
        const { getByText } = render(<Default onPress={onPressMock} />);

        // Check if the data from args is rendered
        expect(getByText('Welcome to iSparta')).toBeTruthy();
        expect(getByText('This is an example screen displaying how Storybook stories can power your Jest tests.')).toBeTruthy();

        // Find the button and simulate a press
        const button = getByText('Get Started');
        fireEvent.press(button);

        // Verify our interaction worked
        expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('renders the CustomContent story correctly', () => {
        // This story uses different args defined in the stories file
        const { getByText } = render(<CustomContent onPress={jest.fn()} />);

        expect(getByText('Profile Settings')).toBeTruthy();
        expect(getByText('Update your account preferences here.')).toBeTruthy();
        expect(getByText('Save Changes')).toBeTruthy();
    });

    it('handles button press on CustomContent story', () => {
        const onPressMock = jest.fn();
        const { getByText } = render(<CustomContent onPress={onPressMock} />);

        const button = getByText('Save Changes');
        fireEvent.press(button);

        expect(onPressMock).toHaveBeenCalledTimes(1);
    });
});
