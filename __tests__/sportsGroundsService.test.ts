import { fetchNearbySportsGrounds, constructSpotUrl, SportsGround } from '../sportsGroundsService';

// Mock global fetch
global.fetch = jest.fn();

describe('Sports Grounds Service', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
    });

    const mockApiResponse = {
        data: [
            {
                id: 123,
                lat: 41.0372817,
                lon: 28.971472,
                m: "s",
                title: "Test Park",
                slug: "test-park-123"
            },
            {
                id: 456,
                lat: 41.0308174,
                lon: 28.9665776,
                m: "s",
                title: "Another Park"
                // slug missing
            }
        ],
        paginator: {
            total_count: 2,
            total_pages: 1,
            current_page: 1,
            limit: 100
        }
    };

    describe('fetchNearbySportsGrounds', () => {
        it('should fetch and parse sports grounds correctly', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const spots = await fetchNearbySportsGrounds(41.0, 28.9);

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(spots.length).toBe(2);

            expect(spots[0]).toEqual({
                id: '123',
                latitude: 41.0372817,
                longitude: 28.971472,
                title: "Test Park",
                url: "https://calisthenics-parks.com/spots/123-en-test-park-123"
            });
        });

        it('should handle network errors gracefully', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            const spots = await fetchNearbySportsGrounds(41.0, 28.9);
            expect(spots).toEqual([]);
        });

        it('should handle empty response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [] })
            });

            const spots = await fetchNearbySportsGrounds(41.0, 28.9);
            expect(spots).toEqual([]);
        });
    });

    describe('constructSpotUrl', () => {
        it('should construct correct URL with slug', () => {
            const spot = { id: 123, slug: 'test-park' };
            const url = constructSpotUrl(spot);
            expect(url).toBe('https://calisthenics-parks.com/spots/123-en-test-park');
        });

        it('should construct correct URL without slug', () => {
            const spot = { id: 456 };
            const url = constructSpotUrl(spot);
            expect(url).toBe('https://calisthenics-parks.com/spots/456');
        });
    });
});
