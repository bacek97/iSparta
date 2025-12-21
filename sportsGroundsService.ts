/**
 * Service to fetch nearby sports grounds from calisthenics-parks.com
 */

export interface SportsGround {
    id: string;
    latitude: number;
    longitude: number;
    title: string;
    url: string;
}

interface ApiSpot {
    id: number | string;
    lat: number;
    lon: number;
    m?: string;
    title?: string;
    slug?: string;
}

interface ApiResponse {
    data: ApiSpot[];
    paginator?: any;
}

const BASE_URL = 'https://calisthenics-parks.com';

/**
 * Construct URL for a spot
 * Format: https://calisthenics-parks.com/spots/{id}-en-{slug}
 */
export function constructSpotUrl(spot: { id: number | string, slug?: string }): string {
    if (spot.slug) {
        return `${BASE_URL}/spots/${spot.id}-en-${spot.slug}`;
    }
    return `${BASE_URL}/spots/${spot.id}`;
}

/**
 * Fetch nearby sports grounds
 */
export async function fetchNearbySportsGrounds(
    lat: number,
    lon: number,
    radius: number = 100,
    limit: number = 100
): Promise<SportsGround[]> {
    try {
        const url = `${BASE_URL}/spots/?s=bubble&limit=${limit}&radius=${radius}&lat=${lat}&lon=${lon}&order=distance`;

        const response = await fetch(url, {
            headers: {
                'accept': 'application/json',
                'x-requested-with': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            console.warn('[SportsGrounds] API error:', response.status);
            return [];
        }

        const json: ApiResponse = await response.json();

        if (!json.data || !Array.isArray(json.data)) {
            return [];
        }

        return json.data.map((spot, index) => {
            const id = spot.id ? String(spot.id) : `spot-${index}`;
            return {
                id,
                latitude: Number(spot.lat),
                longitude: Number(spot.lon),
                title: spot.title || 'Sports Ground',
                url: constructSpotUrl(spot)
            };
        });

    } catch (error) {
        console.error('[SportsGrounds] Fetch error:', error);
        return [];
    }
}
