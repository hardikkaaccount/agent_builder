/**
 * Browse URL Tool
 * Uses Firecrawl scrape API to fetch and parse any URL
 */

export interface BrowseResult {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

export async function browseUrl(url: string): Promise<BrowseResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    return {
      url,
      title: 'Mock Page',
      content: `Mock content for ${url}. Configure FIRECRAWL_API_KEY for real browsing.`,
      success: false,
      error: 'FIRECRAWL_API_KEY not configured',
    };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        url,
        title: 'Failed',
        content: '',
        success: false,
        error: `Firecrawl error: ${err}`,
      };
    }

    const data = await response.json();

    return {
      url,
      title: data.data?.metadata?.title || url,
      content: data.data?.markdown?.slice(0, 5000) || '',
      success: true,
    };
  } catch (error: any) {
    return {
      url,
      title: 'Error',
      content: '',
      success: false,
      error: error.message,
    };
  }
}
