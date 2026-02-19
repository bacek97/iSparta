/**
 * Workout Publications Service
 * Handles GraphQL operations for creating and fetching workout publications
 */

import {
    WorkoutPublication,
    CreatePublicationInput,
    PublicationWithWorkout,
    WorkoutSession,
    EXERCISES
} from './common_types';

const HASURA_URL = 'https://select-bull-98.hasura.app/v1/graphql';

// ==================== GRAPHQL QUERIES ====================

const CREATE_PUBLICATION_MUTATION = `
    mutation CreatePublication($publication: workout_publications_insert_input!) {
        insert_workout_publications_one(object: $publication) {
            id
            session_signature
            user_public_key
            text_content
            images
            map_svg_path
            created_at
            updated_at
        }
    }
`;

const GET_GROUP_PUBLICATIONS_QUERY = `
    query GetGroupPublications($groupId: String!, $limit: Int = 50) {
        workout_publications(
            where: { group_id: { _eq: $groupId } }
            order_by: { created_at: desc }
            limit: $limit
        ) {
            id
            session_signature
            user_public_key
            group_id
            text_content
            images
            map_svg_path
            created_at
            updated_at
            workout_session {
                signature
                session_date
                base_points
                total_points
                exercise_sets {
                    exercise_type
                    reps
                    kilometers
                    seconds
                    points
                }
            }
        }
    }
`;

// Query to get publications from multiple groups
const GET_PUBLICATIONS_FROM_GROUPS_QUERY = `
    query GetPublicationsFromGroups($groupIds: [String!]!, $limit: Int = 100) {
        workout_publications(
            where: { group_id: { _in: $groupIds } }
            order_by: { created_at: desc }
            limit: $limit
        ) {
            id
            session_signature
            user_public_key
            group_id
            text_content
            images
            map_svg_path
            created_at
            updated_at
            workout_session {
                signature
                session_date
                base_points
                total_points
                exercise_sets {
                    exercise_type
                    reps
                    kilometers
                    seconds
                    points
                }
            }
        }
    }
`;

// Query to get publications from followed users
const GET_PUBLICATIONS_FROM_USERS_QUERY = `
    query GetPublicationsFromUsers($userKeys: [String!]!, $limit: Int = 100) {
        workout_publications(
            where: { user_public_key: { _in: $userKeys } }
            order_by: { created_at: desc }
            limit: $limit
        ) {
            id
            session_signature
            user_public_key
            group_id
            text_content
            images
            map_svg_path
            created_at
            updated_at
            workout_session {
                signature
                session_date
                base_points
                total_points
                exercise_sets {
                    exercise_type
                    reps
                    kilometers
                    seconds
                    points
                }
            }
        }
    }
`;


const UPDATE_PUBLICATION_MUTATION = `
    mutation UpdatePublication($id: Int!, $updates: workout_publications_set_input!) {
        update_workout_publications_by_pk(
            pk_columns: { id: $id }
            _set: $updates
        ) {
            id
            session_signature
            user_public_key
            text_content
            images
            map_svg_path
            created_at
            updated_at
        }
    }
`;

const DELETE_PUBLICATION_MUTATION = `
    mutation DeletePublication($id: Int!) {
        delete_workout_publications_by_pk(id: $id) {
            id
        }
    }
`;

const GET_SESSION_SVG_PATH_QUERY = `
    query GetSessionSvgPath($signature: String!) {
        workout_sessions(where: {signature: {_eq: $signature}}, limit: 1) {
            exercise_sets(where: { exercise_category: { _eq: "KILOMETERS" } }) {
                exercise_type
                kilometers
            }
        }
    }
`;

const WS_URL = HASURA_URL.replace('https://', 'wss://');

// ==================== SUBSCRIPTION ====================

/**
 * Subscribe to real-time group publications via WebSocket
 * Returns unsubscribe function
 */
export function subscribeToGroupPublications(
    groupId: string,
    userPublicKey: string,
    onPublications: (publications: PublicationWithWorkout[]) => void,
    onNewPublication?: (publication: PublicationWithWorkout) => void
): () => void {
    const ws = new WebSocket(WS_URL, 'graphql-ws');
    let knownIds = new Set<number>();
    let isFirstUpdate = true;

    const subscription = `
        subscription OnGroupPublications($groupId: String!) {
            workout_publications(
                where: { group_id: { _eq: $groupId } }
                order_by: { created_at: desc }
                limit: 20
            ) {
                id
                session_signature
                user_public_key
                group_id
                text_content
                images
                map_svg_path
                created_at
                updated_at
                workout_session {
                    signature
                    session_date
                    base_points
                    total_points
                    exercise_sets {
                        exercise_type
                        reps
                        kilometers
                        seconds
                        points
                    }
                }
            }
        }
    `;

    ws.onopen = () => {
        console.log('[PublicationsService] WebSocket connected');
        ws.send(JSON.stringify({
            type: 'connection_init',
            payload: {
                headers: {
                    'x-hasura-role': 'anonymous'
                }
            }
        }));
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'connection_ack') {
            console.log('[PublicationsService] Starting subscription...');
            ws.send(JSON.stringify({
                id: 'group-publications',
                type: 'start',
                payload: {
                    query: subscription,
                    variables: { groupId }
                }
            }));
        } else if (message.type === 'data') {
            const publications: PublicationWithWorkout[] = message.payload.data.workout_publications;

            // Deliver all publications
            onPublications(publications);

            // Detect new publications (not from current user)
            if (!isFirstUpdate && onNewPublication) {
                for (const pub of publications) {
                    if (!knownIds.has(pub.id!) && pub.user_public_key !== userPublicKey) {
                        console.log('[PublicationsService] New publication detected:', pub.id);
                        onNewPublication(pub);
                    }
                }
            }

            // Update known IDs
            knownIds = new Set(publications.map(p => p.id!));
            isFirstUpdate = false;
        } else if (message.type === 'error') {
            console.error('[PublicationsService] Subscription error:', message.payload);
        }
    };

    ws.onerror = (error) => {
        console.error('[PublicationsService] WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('[PublicationsService] WebSocket closed');
    };

    // Return unsubscribe function
    return () => {
        console.log('[PublicationsService] Unsubscribing...');
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.send(JSON.stringify({
                id: 'group-publications',
                type: 'stop'
            }));
            ws.close();
        }
    };
}

// ==================== SERVICE FUNCTIONS ====================


/**
 * Create a workout publication
 */
export async function createPublication(
    input: CreatePublicationInput,
    userPublicKey: string
): Promise<WorkoutPublication> {
    // Validate image count
    if (input.images && input.images.length > 5) {
        throw new Error('Maximum 5 images allowed');
    }

    // Check if publication already exists for this session
    const existing = await getPublicationBySession(input.session_signature);
    if (existing) {
        throw new Error('Publication already exists for this session');
    }

    // Use map_svg_path from input if include_map is true
    const mapSvgPath = (input.include_map && input.map_svg_path) ? input.map_svg_path : null;

    const publicationData = {
        session_signature: input.session_signature,
        user_public_key: userPublicKey,
        group_id: input.group_id,  // Required for foreign key constraint
        text_content: input.text_content || null,
        images: input.images || [],
        map_svg_path: mapSvgPath,
    };

    const result = await executeGraphQL(CREATE_PUBLICATION_MUTATION, {
        publication: publicationData,
    });

    return result.insert_workout_publications_one;
}

/**
 * Get publications for a group
 */
export async function getGroupPublications(
    groupId: string,
    limit: number = 50
): Promise<PublicationWithWorkout[]> {
    const result = await executeGraphQL(GET_GROUP_PUBLICATIONS_QUERY, {
        groupId,
        limit,
    });

    return result.workout_publications || [];
}

/**
 * Update a publication
 */
export async function updatePublication(
    id: number,
    updates: Partial<Pick<WorkoutPublication, 'text_content' | 'images'>>
): Promise<WorkoutPublication> {
    // Validate image count
    if (updates.images && updates.images.length > 5) {
        throw new Error('Maximum 5 images allowed');
    }

    const result = await executeGraphQL(UPDATE_PUBLICATION_MUTATION, {
        id,
        updates: {
            ...updates,
            updated_at: new Date().toISOString(),
        },
    });

    return result.update_workout_publications_by_pk;
}

/**
 * Delete a publication
 */
export async function deletePublication(id: number): Promise<void> {
    await executeGraphQL(DELETE_PUBLICATION_MUTATION, { id });
}

/**
 * Get publication by session signature
 */
async function getPublicationBySession(
    sessionSignature: string
): Promise<WorkoutPublication | null> {
    const query = `
        query GetPublicationBySession($signature: String!) {
            workout_publications(where: { session_signature: { _eq: $signature } }, limit: 1) {
                id
                session_signature
            }
        }
    `;

    const result = await executeGraphQL(query, { signature: sessionSignature });
    return result.workout_publications?.[0] || null;
}

/**
 * Get SVG path from a RUNNING workout session
 * NOTE: SVG path storage is not yet implemented in database
 * This function validates the session has KILOMETERS exercise but returns null for now
 */
async function getSessionSvgPath(sessionSignature: string): Promise<string | null> {
    const result = await executeGraphQL(GET_SESSION_SVG_PATH_QUERY, {
        signature: sessionSignature,
    });

    const session = result.workout_sessions?.[0];
    if (!session) {
        return null;
    }

    const exerciseSets = session.exercise_sets || [];

    // Check if session has distance-based exercises (RUNNING, CYCLING, etc.)
    const hasDistanceExercise = exerciseSets.some((set: any) =>
        set.exercise_category === 'KILOMETERS' && set.kilometers > 0
    );

    // SVG path storage not implemented yet - return null
    // TODO: Implement SVG path storage in future
    return null;
}

/**
 * Get aggregated feed publications from all user's groups and followed users
 */
export async function getUserFeedPublications(
    userKey: string,
    limit: number = 100
): Promise<PublicationWithWorkout[]> {
    // Import functions dynamically to avoid circular dependency
    const { getUserGroups } = require('./groupService');
    const { getFollowing } = require('./userRelationsService');

    try {
        // Get all user's groups and followed users in parallel
        const [userGroups, followedUsers] = await Promise.all([
            getUserGroups(userKey).catch(() => []),
            getFollowing(userKey).catch(() => [])
        ]);

        const groupIds = userGroups.map((g: any) => g.group?.group_id || g.group_id).filter(Boolean);
        const followedUserKeys = followedUsers.map((f: any) => f.to_user_key).filter(Boolean);

        console.log('[PublicationsService] Feed sources - groups:', groupIds.length, 'followed:', followedUserKeys.length);

        // Fetch publications from both sources
        const results = await Promise.all([
            groupIds.length > 0
                ? executeGraphQL(GET_PUBLICATIONS_FROM_GROUPS_QUERY, { groupIds, limit })
                : Promise.resolve({ workout_publications: [] }),
            followedUserKeys.length > 0
                ? executeGraphQL(GET_PUBLICATIONS_FROM_USERS_QUERY, { userKeys: followedUserKeys, limit })
                : Promise.resolve({ workout_publications: [] })
        ]);

        // Combine and deduplicate by id
        const allPublications = [
            ...(results[0].workout_publications || []),
            ...(results[1].workout_publications || [])
        ];

        // Deduplicate by id
        const seen = new Set<number>();
        const uniquePublications = allPublications.filter(pub => {
            if (seen.has(pub.id)) return false;
            seen.add(pub.id);
            return true;
        });

        // Sort by created_at desc
        uniquePublications.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return uniquePublications.slice(0, limit);
    } catch (error) {
        console.error('[PublicationsService] getUserFeedPublications error:', error);
        return [];
    }
}

/**
 * Execute GraphQL query/mutation
 */
async function executeGraphQL(query: string, variables: any): Promise<any> {
    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-role': 'anonymous',
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
        console.error('[PublicationsService] GraphQL error:', result.errors);
        throw new Error(result.errors[0].message);
    }

    return result.data;
}
