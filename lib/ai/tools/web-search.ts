/**
 * Web Search Tool
 * Uses Firecrawl search API (key already in .env as FIRECRAWL_API_KEY)
 * Falls back to a structured mock if the key is unavailable
 */

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  content?: string;
}

export async function webSearch(
  query: string,
  maxResults: number = 5
): Promise<SearchResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    console.warn('[WebSearch] FIRECRAWL_API_KEY not set — returning mock results');
    return getMockResults(query);
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: maxResults,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WebSearch] Firecrawl error:', err);
      return getMockResults(query);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      return getMockResults(query);
    }

    return (data.data as any[]).map((item: any) => ({
      title: item.metadata?.title || item.url || 'Untitled',
      url: item.url || '',
      description: item.metadata?.description || '',
      content: item.markdown?.slice(0, 2000) || '',
    }));
  } catch (error) {
    console.error('[WebSearch] Error calling Firecrawl:', error);
    return getMockResults(query);
  }
}

function getMockResults(query: string): SearchResult[] {
  return [
    {
      title: `Search results for: "${query}"`,
      url: `https://example.com/search?q=${encodeURIComponent(query)}`,
      description: `This is a mock result. Configure FIRECRAWL_API_KEY for real web search.`,
      content: `Mock content for query: ${query}. This would contain real web content with a valid API key.`,
    },
  ];
}
