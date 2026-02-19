/**
 * UserSearchComponent
 * Search component for finding users by nickname or public key
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    TextInput,
    FlatList,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { searchUsers, SearchResult } from '../userSearchService';
import { FollowButton } from './FollowButton';

interface UserSearchComponentProps {
    currentUserKey: string;
    onUserSelect?: (user: SearchResult) => void;
}

export const UserSearchComponent: React.FC<UserSearchComponentProps> = ({
    currentUserKey,
    onUserSelect
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Debounced search
    const handleSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.trim().length < 2) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        try {
            setLoading(true);
            setHasSearched(true);
            const searchResults = await searchUsers(searchQuery, 20);
            setResults(searchResults);
        } catch (error) {
            console.error('[UserSearchComponent] Search error:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce input
    const handleQueryChange = useCallback((text: string) => {
        setQuery(text);

        // Simple debounce
        const timeoutId = setTimeout(() => {
            handleSearch(text);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [handleSearch]);

    const renderUser = ({ item }: { item: SearchResult }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => onUserSelect?.(item)}
        >
            <View style={styles.userInfo}>
                <Text style={styles.nickname}>
                    {item.nickname || 'Без никнейма'}
                </Text>
                <Text style={styles.publicKey} numberOfLines={1}>
                    {item.ed25519_public_key.slice(0, 24)}...
                </Text>
                <Text style={styles.category}>
                    {item.fms_category}
                </Text>
            </View>
            <FollowButton
                currentUserKey={currentUserKey}
                targetUserKey={item.ed25519_public_key}
            />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Поиск по никнейму или ключу..."
                    placeholderTextColor="#888"
                    value={query}
                    onChangeText={handleQueryChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {loading && (
                    <ActivityIndicator
                        style={styles.loadingIndicator}
                        size="small"
                        color="#4CAF50"
                    />
                )}
            </View>

            {hasSearched && results.length === 0 && !loading && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        Пользователи не найдены
                    </Text>
                </View>
            )}

            <FlatList
                data={results}
                keyExtractor={(item) => item.ed25519_public_key}
                renderItem={renderUser}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        margin: 16,
        paddingHorizontal: 16,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        paddingVertical: 12,
    },
    loadingIndicator: {
        marginLeft: 8,
    },
    listContent: {
        paddingHorizontal: 16,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
    },
    userInfo: {
        flex: 1,
    },
    nickname: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    publicKey: {
        color: '#888',
        fontSize: 12,
        marginBottom: 2,
    },
    category: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
    },
});

export default UserSearchComponent;
