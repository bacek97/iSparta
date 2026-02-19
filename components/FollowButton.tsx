/**
 * FollowButton Component
 * Button for following/unfollowing users
 */

import React, { useState, useEffect } from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { followUser, unfollowUser, isFollowing } from '../userRelationsService';

interface FollowButtonProps {
    currentUserKey: string;
    targetUserKey: string;
    onFollowChange?: (isFollowing: boolean) => void;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
    currentUserKey,
    targetUserKey,
    onFollowChange
}) => {
    const [following, setFollowing] = useState(false);
    const [loading, setLoading] = useState(true);

    // Don't show button if viewing own profile
    if (currentUserKey === targetUserKey) {
        return null;
    }

    useEffect(() => {
        checkFollowStatus();
    }, [currentUserKey, targetUserKey]);

    const checkFollowStatus = async () => {
        try {
            setLoading(true);
            const result = await isFollowing(currentUserKey, targetUserKey);
            setFollowing(result);
        } catch (error) {
            console.error('[FollowButton] Check follow status error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePress = async () => {
        if (loading) return;

        try {
            setLoading(true);

            if (following) {
                await unfollowUser(currentUserKey, targetUserKey);
                setFollowing(false);
                onFollowChange?.(false);
            } else {
                await followUser(currentUserKey, targetUserKey);
                setFollowing(true);
                onFollowChange?.(true);
            }
        } catch (error) {
            console.error('[FollowButton] Toggle follow error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                following ? styles.followingButton : styles.followButton
            ]}
            onPress={handlePress}
            disabled={loading}
        >
            {loading ? (
                <ActivityIndicator size="small" color={following ? '#666' : '#fff'} />
            ) : (
                <Text style={[
                    styles.buttonText,
                    following ? styles.followingText : styles.followText
                ]}>
                    {following ? 'Отписаться' : 'Подписаться'}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    followButton: {
        backgroundColor: '#4CAF50',
    },
    followingButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#666',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    followText: {
        color: '#fff',
    },
    followingText: {
        color: '#666',
    },
});

export default FollowButton;
