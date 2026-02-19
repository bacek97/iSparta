/**
 * User Search Service
 * Handles searching users by nickname and public key via Hasura GraphQL
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

// ==================== TYPES ====================

export interface SearchResult {
    ed25519_public_key: string;
    nickname: string | null;
    fms_category: string;
    created_at: string;
}

// ==================== HELPER ====================

async function hasuraQuery(query: string, variables?: any): Promise<any> {
    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({ query, variables })
    });

    const data = await response.json();

    if (data.errors) {
        throw new Error(data.errors[0].message);
    }

    return data.data;
}

// ==================== SEARCH BY NICKNAME ====================

/**
 * Search users by nickname (case-insensitive partial match)
 * @param searchQuery - Nickname to search for
 * @param limit - Maximum results to return (default 20)
 * @returns Array of matching users
 */
export async function searchByNickname(
    searchQuery: string,
    limit: number = 20
): Promise<SearchResult[]> {
    if (!searchQuery.trim()) {
        return [];
    }

    const query = `
        query SearchByNickname($pattern: String!, $limit: Int!) {
            users(
                where: { nickname: { _ilike: $pattern } },
                limit: $limit,
                order_by: { nickname: asc }
            ) {
                ed25519_public_key
                nickname
                fms_category
                created_at
            }
        }
    `;

    const data = await hasuraQuery(query, {
        pattern: `%${searchQuery}%`,
        limit
    });

    return data.users;
}

// ==================== SEARCH BY PUBLIC KEY ====================

/**
 * Search users by public key prefix
 * @param searchQuery - Public key prefix to search for
 * @param limit - Maximum results to return (default 20)
 * @returns Array of matching users
 */
export async function searchByPublicKey(
    searchQuery: string,
    limit: number = 20
): Promise<SearchResult[]> {
    if (!searchQuery.trim()) {
        return [];
    }

    const query = `
        query SearchByPublicKey($pattern: String!, $limit: Int!) {
            users(
                where: { ed25519_public_key: { _like: $pattern } },
                limit: $limit,
                order_by: { ed25519_public_key: asc }
            ) {
                ed25519_public_key
                nickname
                fms_category
                created_at
            }
        }
    `;

    const data = await hasuraQuery(query, {
        pattern: `%${searchQuery}%`,
        limit
    });

    return data.users;
}

// ==================== COMBINED SEARCH ====================

/**
 * Search users by nickname OR public key
 * @param searchQuery - Query to search for
 * @param limit - Maximum results to return (default 20)
 * @returns Array of matching users (deduplicated)
 */
export async function searchUsers(
    searchQuery: string,
    limit: number = 20
): Promise<SearchResult[]> {
    if (!searchQuery.trim()) {
        return [];
    }

    const query = `
        query CombinedSearch($nicknamePattern: String!, $keyPattern: String!, $limit: Int!) {
            users(
                where: {
                    _or: [
                        { nickname: { _ilike: $nicknamePattern } },
                        { ed25519_public_key: { _like: $keyPattern } }
                    ]
                },
                limit: $limit,
                order_by: { nickname: asc_nulls_last }
            ) {
                ed25519_public_key
                nickname
                fms_category
                created_at
            }
        }
    `;

    const data = await hasuraQuery(query, {
        nicknamePattern: `%${searchQuery}%`,
        keyPattern: `%${searchQuery}%`,
        limit
    });

    return data.users;
}

// ==================== GET USER BY NICKNAME ====================

/**
 * Get user by exact nickname
 * @param nickname - Exact nickname to find
 * @returns User if found, null otherwise
 */
export async function getUserByNickname(nickname: string): Promise<SearchResult | null> {
    const query = `
        query GetUserByNickname($nickname: String!) {
            users(where: { nickname: { _eq: $nickname } }, limit: 1) {
                ed25519_public_key
                nickname
                fms_category
                created_at
            }
        }
    `;

    const data = await hasuraQuery(query, { nickname });
    return data.users[0] || null;
}
