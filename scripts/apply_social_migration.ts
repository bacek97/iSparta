/**
 * Database Migration Script for Social Features
 * Applies schema changes via Hasura's run_sql endpoint
 * 
 * Run: npx ts-node scripts/apply_social_migration.ts
 */

const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

async function runSQL(sql: string): Promise<any> {
    // Use v1/query without source specification for older Hasura versions
    const response = await fetch(`${HASURA_URL}/v1/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            type: 'run_sql',
            args: {
                sql: sql,
                cascade: false
            }
        })
    });

    const result = await response.json();
    return result;
}

async function trackTable(tableName: string): Promise<any> {
    const response = await fetch(`${HASURA_URL}/v1/metadata`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            type: 'pg_track_table',
            args: {
                source: 'default',
                table: {
                    schema: 'public',
                    name: tableName
                }
            }
        })
    });

    const result = await response.json();
    return result;
}

async function createRelationship(table: string, name: string, config: any): Promise<any> {
    const response = await fetch(`${HASURA_URL}/v1/metadata`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            type: config.type === 'object' ? 'pg_create_object_relationship' : 'pg_create_array_relationship',
            args: {
                source: 'default',
                table: {
                    schema: 'public',
                    name: table
                },
                name: name,
                using: config.using
            }
        })
    });

    const result = await response.json();
    return result;
}

async function setSelectPermission(table: string, role: string, config: any): Promise<any> {
    const response = await fetch(`${HASURA_URL}/v1/metadata`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            type: 'pg_create_select_permission',
            args: {
                source: 'default',
                table: {
                    schema: 'public',
                    name: table
                },
                role: role,
                permission: config
            }
        })
    });

    const result = await response.json();
    return result;
}

async function setInsertPermission(table: string, role: string, config: any): Promise<any> {
    const response = await fetch(`${HASURA_URL}/v1/metadata`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            type: 'pg_create_insert_permission',
            args: {
                source: 'default',
                table: {
                    schema: 'public',
                    name: table
                },
                role: role,
                permission: config
            }
        })
    });

    const result = await response.json();
    return result;
}

async function setDeletePermission(table: string, role: string, config: any): Promise<any> {
    const response = await fetch(`${HASURA_URL}/v1/metadata`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
            type: 'pg_create_delete_permission',
            args: {
                source: 'default',
                table: {
                    schema: 'public',
                    name: table
                },
                role: role,
                permission: config
            }
        })
    });

    const result = await response.json();
    return result;
}

async function main() {
    console.log('🚀 Starting Social Features Migration...\n');

    // Step 1: Create user_follows table
    console.log('📦 Creating user_follows table...');
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS user_follows (
            id SERIAL PRIMARY KEY,
            follower_public_key TEXT NOT NULL REFERENCES users(ed25519_public_key) ON DELETE CASCADE,
            followee_public_key TEXT NOT NULL REFERENCES users(ed25519_public_key) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT unique_follow UNIQUE(follower_public_key, followee_public_key),
            CONSTRAINT no_self_follow CHECK (follower_public_key != followee_public_key)
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_public_key);
        CREATE INDEX IF NOT EXISTS idx_user_follows_followee ON user_follows(followee_public_key);
    `;

    const tableResult = await runSQL(createTableSQL);
    if (tableResult.error) {
        console.error('❌ Error creating table:', tableResult.error);
    } else {
        console.log('✅ user_follows table created');
    }

    // Step 2: Add nickname column to users
    console.log('\n📝 Adding nickname column to users...');
    const addColumnSQL = `
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'nickname'
            ) THEN
                ALTER TABLE users ADD COLUMN nickname TEXT UNIQUE;
            END IF;
        END $$;
        
        CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
    `;

    const columnResult = await runSQL(addColumnSQL);
    if (columnResult.error) {
        console.error('❌ Error adding column:', columnResult.error);
    } else {
        console.log('✅ nickname column added');
    }

    // Step 3: Track the table
    console.log('\n📊 Tracking user_follows table...');
    const trackResult = await trackTable('user_follows');
    if (trackResult.error || trackResult.code) {
        if (trackResult.error?.includes('already tracked') || trackResult.code === 'already-tracked') {
            console.log('ℹ️  Table already tracked');
        } else {
            console.error('❌ Error tracking table:', trackResult);
        }
    } else {
        console.log('✅ Table tracked');
    }

    // Step 4: Create relationships
    console.log('\n🔗 Creating relationships...');

    // user_follows -> users (follower)
    const followerRel = await createRelationship('user_follows', 'follower', {
        type: 'object',
        using: {
            foreign_key_constraint_on: 'follower_public_key'
        }
    });
    console.log('  follower relationship:', followerRel.error ? `⚠️ ${followerRel.error}` : '✅');

    // user_follows -> users (followee)
    const followeeRel = await createRelationship('user_follows', 'followee', {
        type: 'object',
        using: {
            foreign_key_constraint_on: 'followee_public_key'
        }
    });
    console.log('  followee relationship:', followeeRel.error ? `⚠️ ${followeeRel.error}` : '✅');

    // users -> user_follows (followers array)
    const followersRel = await createRelationship('users', 'followers', {
        type: 'array',
        using: {
            foreign_key_constraint_on: {
                column: 'followee_public_key',
                table: {
                    schema: 'public',
                    name: 'user_follows'
                }
            }
        }
    });
    console.log('  followers relationship:', followersRel.error ? `⚠️ ${followersRel.error}` : '✅');

    // users -> user_follows (following array)
    const followingRel = await createRelationship('users', 'following', {
        type: 'array',
        using: {
            foreign_key_constraint_on: {
                column: 'follower_public_key',
                table: {
                    schema: 'public',
                    name: 'user_follows'
                }
            }
        }
    });
    console.log('  following relationship:', followingRel.error ? `⚠️ ${followingRel.error}` : '✅');

    // Step 5: Set permissions for anonymous role
    console.log('\n🔐 Setting permissions...');

    // Select permission
    const selectPerm = await setSelectPermission('user_follows', 'anonymous', {
        columns: ['id', 'follower_public_key', 'followee_public_key', 'created_at'],
        filter: {}
    });
    console.log('  SELECT:', selectPerm.error ? `⚠️ ${selectPerm.error}` : '✅');

    // Insert permission
    const insertPerm = await setInsertPermission('user_follows', 'anonymous', {
        columns: ['follower_public_key', 'followee_public_key'],
        check: {}
    });
    console.log('  INSERT:', insertPerm.error ? `⚠️ ${insertPerm.error}` : '✅');

    // Delete permission
    const deletePerm = await setDeletePermission('user_follows', 'anonymous', {
        filter: {}
    });
    console.log('  DELETE:', deletePerm.error ? `⚠️ ${deletePerm.error}` : '✅');

    console.log('\n✅ Migration complete!');
}

main().catch(console.error);
