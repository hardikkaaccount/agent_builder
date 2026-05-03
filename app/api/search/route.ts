import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Check if API key is set
    if (!process.env.FIRECRAWL_API_KEY) {
      console.error('[Search] FIRECRAWL_API_KEY is not set');
      return NextResponse.json(
        { error: 'Search API not configured' },
        { status: 500 }
      );
    }

    // Use Firecrawl search to get top 10 results with screenshots
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        limit: 10,
        scrapeOptions: {
          formats: ['markdown', 'screenshot'],
          onlyMainContent: true,
        },
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`[Search] API error (${searchResponse.status}):`, errorText);
      throw new Error(`Search API returned ${searchResponse.status}: ${errorText}`);
    }

    const searchData = await searchResponse.json();
    
    // Format results with screenshots and markdown
    const results = searchData.data?.map((result: any) => ({
      url: result.url,
      title: result.title || result.url,
      description: result.description || '',
      screenshot: result.screenshot || null,
      markdown: result.markdown || '',
    })) || [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform search' },
      { status: 500 }
    );
  }
}