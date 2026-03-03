import type { Meta, StoryObj } from '@storybook/react';
import { ExampleScreen } from './ExampleScreen';

const meta = {
    title: 'Screens/ExampleScreen',
    component: ExampleScreen,
    args: {
        title: 'Welcome to iSparta',
        description: 'This is an example screen displaying how Storybook stories can power your Jest tests.',
        buttonText: 'Get Started',
    },
} satisfies Meta<typeof ExampleScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomContent: Story = {
    args: {
        title: 'Profile Settings',
        description: 'Update your account preferences here.',
        buttonText: 'Save Changes',
    },
};
