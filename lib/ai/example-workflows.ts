import { Workflow } from '@/types/agent';

/**
 * Example Workflows - Pre-built workflow templates for demonstration and testing
 * Three complete example workflows showcasing the multi-agent orchestration system
 */

// ============================================================================
// TRAVEL AGENT WORKFLOW
// ============================================================================

export const travelAgentWorkflow: Workflow = {
  id: 'travel-agent-workflow',
  name: 'Travel Agent',
  description: 'Complete vacation planning - research, itinerary, accommodations, flights, budget',
  version: 1,
  goal: 'Plan a complete vacation to a dream destination with optimized budget and activities',
  category: 'travel',
  status: 'draft',
  createdAt: new Date(),
  updatedAt: new Date(),
  environment: {},
  parallelExecution: true,
  maxRetries: 2,
  timeout: 120000,
  nodeCount: 7,
  edgeCount: 12,
  complexity: 'complex',
  nodes: [
    {
      id: 'gather-requirements',
      name: 'Gather Trip Requirements',
      description: 'Collect user preferences, budget, dates, and constraints',
      role: 'worker',
      task: 'Gather trip requirements',
      environment: {},
      inputs: {
        destination: { type: 'string', description: 'Desired destination' },
        budget: { type: 'number', description: 'Budget in USD' },
        duration: { type: 'number', description: 'Trip duration in days' },
        travelStyle: { type: 'string', description: 'budget/comfort/luxury' },
      },
      outputs: {
        requirements: { type: 'object', description: 'Structured requirements' },
        constraints: { type: 'array', description: 'Constraints' },
        preferences: { type: 'object', description: 'User preferences' },
      },
      dependencies: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'research-destination',
      name: 'Research Destination',
      description: 'Gather info about destination, climate, attractions, safety',
      role: 'worker',
      task: 'Research destination',
      environment: {},
      inputs: {
        destination: { type: 'string', description: 'Destination name' },
        season: { type: 'string', description: 'Desired season' },
        interests: { type: 'array', description: 'Interests' },
      },
      outputs: {
        attractions: { type: 'array', description: 'Top attractions' },
        bestSeason: { type: 'string', description: 'Best time to visit' },
        estimatedCosts: { type: 'object', description: 'Cost breakdown' },
        safetyInfo: { type: 'object', description: 'Safety information' },
      },
      dependencies: ['gather-requirements'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'plan-itinerary',
      name: 'Plan Detailed Itinerary',
      description: 'Create day-by-day itinerary based on interests and budget',
      role: 'worker',
      task: 'Plan itinerary',
      environment: {},
      inputs: {
        destination: { type: 'string', description: 'Destination' },
        duration: { type: 'number', description: 'Duration in days' },
        preferences: { type: 'object', description: 'User preferences' },
      },
      outputs: {
        itinerary: { type: 'array', description: 'Day-by-day activities' },
        estimatedDuration: { type: 'number', description: 'Hours to complete' },
        recommendations: { type: 'array', description: 'Recommendations' },
      },
      dependencies: ['research-destination'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'find-accommodations',
      name: 'Find Accommodations',
      description: 'Search and compare hotel and accommodation options',
      role: 'worker',
      task: 'Find accommodations',
      environment: {},
      inputs: {
        destination: { type: 'string', description: 'Destination' },
        dates: { type: 'string', description: 'Travel dates' },
        budget: { type: 'number', description: 'Budget' },
        travelStyle: { type: 'string', description: 'Travel style' },
      },
      outputs: {
        options: { type: 'array', description: 'Accommodation options' },
        topChoice: { type: 'object', description: 'Recommended choice' },
        priceRange: { type: 'object', description: 'Price statistics' },
      },
      dependencies: ['gather-requirements'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'compare-flights',
      name: 'Compare Flight Options',
      description: 'Search and compare available flights to destination',
      role: 'worker',
      task: 'Compare flights',
      environment: {},
      inputs: {
        origin: { type: 'string', description: 'Origin city' },
        destination: { type: 'string', description: 'Destination city' },
        dates: { type: 'string', description: 'Travel dates' },
        budget: { type: 'number', description: 'Budget' },
      },
      outputs: {
        options: { type: 'array', description: 'Flight options' },
        bestOption: { type: 'object', description: 'Best option' },
        totalFlightCost: { type: 'number', description: 'Total cost' },
      },
      dependencies: ['gather-requirements'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'calculate-budget',
      name: 'Calculate Total Trip Budget',
      description: 'Aggregate all costs and create budget breakdown',
      role: 'worker',
      task: 'Calculate budget',
      environment: {},
      inputs: {
        flightCost: { type: 'number', description: 'Flight cost' },
        accommodationCost: { type: 'number', description: 'Accommodation cost' },
        estimatedDuration: { type: 'number', description: 'Duration' },
        activitiesBudget: { type: 'number', description: 'Activities budget' },
      },
      outputs: {
        budgetBreakdown: { type: 'object', description: 'Cost breakdown' },
        totalEstimatedCost: { type: 'number', description: 'Total cost' },
        isFeasible: { type: 'boolean', description: 'Within budget' },
        savings: { type: 'number', description: 'Potential savings' },
      },
      dependencies: ['compare-flights', 'find-accommodations', 'plan-itinerary'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prepare-recommendations',
      name: 'Prepare Final Recommendations',
      description: 'Generate comprehensive travel recommendations and booking summary',
      role: 'worker',
      task: 'Prepare recommendations',
      environment: {},
      inputs: {
        itinerary: { type: 'array', description: 'Itinerary' },
        accommodations: { type: 'object', description: 'Recommendations' },
        flights: { type: 'object', description: 'Best flights' },
        budget: { type: 'object', description: 'Budget breakdown' },
      },
      outputs: {
        recommendation: { type: 'object', description: 'Complete recommendation' },
        summary: { type: 'string', description: 'Executive summary' },
        bookingLinks: { type: 'array', description: 'Booking links' },
      },
      dependencies: ['calculate-budget'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  edges: [
    { from: 'gather-requirements', to: 'research-destination' },
    { from: 'gather-requirements', to: 'find-accommodations' },
    { from: 'gather-requirements', to: 'compare-flights' },
    { from: 'research-destination', to: 'plan-itinerary' },
    { from: 'plan-itinerary', to: 'calculate-budget' },
    { from: 'find-accommodations', to: 'calculate-budget' },
    { from: 'compare-flights', to: 'calculate-budget' },
    { from: 'calculate-budget', to: 'prepare-recommendations' },
  ],
  executionOrder: [
    'gather-requirements',
    'research-destination',
    'find-accommodations',
    'compare-flights',
    'plan-itinerary',
    'calculate-budget',
    'prepare-recommendations',
  ],
};

// ============================================================================
// DATA ANALYSIS WORKFLOW
// ============================================================================

export const dataAnalysisWorkflow: Workflow = {
  id: 'data-analysis-workflow',
  name: 'Data Analysis Pipeline',
  description: 'Process raw data, clean it, perform analysis, and generate insights',
  version: 1,
  goal: 'Transform raw data into actionable business intelligence',
  category: 'data-analysis',
  status: 'draft',
  createdAt: new Date(),
  updatedAt: new Date(),
  environment: {},
  parallelExecution: true,
  maxRetries: 2,
  timeout: 90000,
  nodeCount: 6,
  edgeCount: 6,
  complexity: 'moderate',
  nodes: [
    {
      id: 'load-data',
      name: 'Load and Inspect Data',
      description: 'Load data source and perform initial inspection',
      role: 'worker',
      task: 'Load and inspect data',
      environment: {},
      inputs: {
        source: { type: 'string', description: 'Data source' },
        format: { type: 'string', description: 'Format (CSV, JSON, etc)' },
      },
      outputs: {
        rowCount: { type: 'number', description: 'Total rows' },
        columnCount: { type: 'number', description: 'Total columns' },
        schema: { type: 'object', description: 'Column info' },
        preview: { type: 'array', description: 'Sample rows' },
      },
      dependencies: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'clean-data',
      name: 'Clean and Validate Data',
      description: 'Handle missing values, remove duplicates, validate data types',
      role: 'worker',
      task: 'Clean and validate data',
      environment: {},
      inputs: {
        data: { type: 'object', description: 'Input data' },
        nullHandling: { type: 'string', description: 'How to handle nulls' },
      },
      outputs: {
        cleanedRowCount: { type: 'number', description: 'Cleaned rows' },
        removedRows: { type: 'number', description: 'Rows removed' },
        nullValues: { type: 'object', description: 'Null stats' },
        qualityScore: { type: 'number', description: 'Quality 0-100' },
      },
      dependencies: ['load-data'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'exploratory-analysis',
      name: 'Exploratory Data Analysis',
      description: 'Generate summary statistics and identify patterns',
      role: 'worker',
      task: 'Perform exploratory analysis',
      environment: {},
      inputs: {
        cleanedData: { type: 'object', description: 'Cleaned data' },
        focusColumns: { type: 'array', description: 'Columns to analyze' },
      },
      outputs: {
        statistics: { type: 'object', description: 'Summary statistics' },
        distributions: { type: 'object', description: 'Distributions' },
        correlations: { type: 'object', description: 'Correlations' },
        outliers: { type: 'array', description: 'Outliers found' },
      },
      dependencies: ['clean-data'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'feature-engineering',
      name: 'Feature Engineering',
      description: 'Create derived features and transformations',
      role: 'worker',
      task: 'Engineer features',
      environment: {},
      inputs: {
        cleanedData: { type: 'object', description: 'Cleaned data' },
        targetVariable: { type: 'string', description: 'Target variable' },
      },
      outputs: {
        features: { type: 'array', description: 'Features' },
        importance: { type: 'object', description: 'Feature importance' },
        transformations: { type: 'array', description: 'Transformations' },
      },
      dependencies: ['clean-data'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'generate-insights',
      name: 'Generate Business Insights',
      description: 'Synthesize findings and create actionable insights',
      role: 'worker',
      task: 'Generate insights',
      environment: {},
      inputs: {
        statistics: { type: 'object', description: 'Statistics' },
        correlations: { type: 'object', description: 'Correlations' },
        features: { type: 'array', description: 'Features' },
      },
      outputs: {
        insights: { type: 'array', description: 'Key findings' },
        opportunities: { type: 'array', description: 'Opportunities' },
        recommendations: { type: 'array', description: 'Recommendations' },
        confidence: { type: 'number', description: 'Confidence 0-100' },
      },
      dependencies: ['exploratory-analysis', 'feature-engineering'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'create-report',
      name: 'Create Analysis Report',
      description: 'Compile findings into comprehensive report',
      role: 'worker',
      task: 'Create report',
      environment: {},
      inputs: {
        insights: { type: 'array', description: 'Insights' },
        statistics: { type: 'object', description: 'Statistics' },
        recommendations: { type: 'array', description: 'Recommendations' },
      },
      outputs: {
        report: { type: 'string', description: 'Report markdown' },
        summary: { type: 'string', description: 'Executive summary' },
        visualizations: { type: 'array', description: 'Chart descriptions' },
      },
      dependencies: ['generate-insights'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  edges: [
    { from: 'load-data', to: 'clean-data' },
    { from: 'clean-data', to: 'exploratory-analysis' },
    { from: 'clean-data', to: 'feature-engineering' },
    { from: 'exploratory-analysis', to: 'generate-insights' },
    { from: 'feature-engineering', to: 'generate-insights' },
    { from: 'generate-insights', to: 'create-report' },
  ],
  executionOrder: [
    'load-data',
    'clean-data',
    'exploratory-analysis',
    'feature-engineering',
    'generate-insights',
    'create-report',
  ],
};

// ============================================================================
// CONTENT CREATION WORKFLOW
// ============================================================================

export const contentCreationWorkflow: Workflow = {
  id: 'content-creation-workflow',
  name: 'Content Creation Pipeline',
  description: 'End-to-end content production from research to published article',
  version: 1,
  goal: 'Create high-quality, SEO-optimized content from initial brief to publication',
  category: 'content',
  status: 'draft',
  createdAt: new Date(),
  updatedAt: new Date(),
  environment: {},
  parallelExecution: false,
  maxRetries: 2,
  timeout: 180000,
  nodeCount: 6,
  edgeCount: 5,
  complexity: 'complex',
  nodes: [
    {
      id: 'analyze-brief',
      name: 'Analyze Content Brief',
      description: 'Understand requirements, audience, and key topics',
      role: 'worker',
      task: 'Analyze brief',
      environment: {},
      inputs: {
        topic: { type: 'string', description: 'Content topic' },
        audience: { type: 'string', description: 'Target audience' },
        keywords: { type: 'array', description: 'Keywords' },
        tone: { type: 'string', description: 'Content tone' },
      },
      outputs: {
        requirements: { type: 'object', description: 'Requirements' },
        outline: { type: 'array', description: 'Outline' },
        keyMessages: { type: 'array', description: 'Key messages' },
      },
      dependencies: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'research-topic',
      name: 'Research Topic Deeply',
      description: 'Gather comprehensive information and sources',
      role: 'worker',
      task: 'Research topic',
      environment: {},
      inputs: {
        topic: { type: 'string', description: 'Topic' },
        keywords: { type: 'array', description: 'Keywords' },
        depth: { type: 'string', description: 'Depth level' },
      },
      outputs: {
        sources: { type: 'array', description: 'Sources' },
        facts: { type: 'array', description: 'Facts' },
        concepts: { type: 'object', description: 'Concepts' },
      },
      dependencies: ['analyze-brief'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'write-draft',
      name: 'Write Content Draft',
      description: 'Generate initial content draft based on outline and research',
      role: 'worker',
      task: 'Write draft',
      environment: {},
      inputs: {
        outline: { type: 'array', description: 'Outline' },
        facts: { type: 'array', description: 'Facts' },
        tone: { type: 'string', description: 'Tone' },
        length: { type: 'number', description: 'Word count' },
      },
      outputs: {
        draft: { type: 'string', description: 'Draft content' },
        wordCount: { type: 'number', description: 'Word count' },
        warnings: { type: 'array', description: 'Warnings' },
      },
      dependencies: ['research-topic'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'optimize-seo',
      name: 'Optimize for SEO',
      description: 'Enhance content for search engine visibility',
      role: 'worker',
      task: 'Optimize SEO',
      environment: {},
      inputs: {
        draft: { type: 'string', description: 'Draft' },
        keywords: { type: 'array', description: 'Keywords' },
        title: { type: 'string', description: 'Title' },
      },
      outputs: {
        optimizedContent: { type: 'string', description: 'Optimized content' },
        metaDescription: { type: 'string', description: 'Meta description' },
        suggestions: { type: 'array', description: 'Suggestions' },
        seoScore: { type: 'number', description: 'SEO score' },
      },
      dependencies: ['write-draft'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'technical-review',
      name: 'Technical Review and QA',
      description: 'Check for accuracy, broken links, formatting issues',
      role: 'worker',
      task: 'Technical review',
      environment: {},
      inputs: {
        content: { type: 'string', description: 'Content' },
        sources: { type: 'array', description: 'Sources' },
      },
      outputs: {
        issues: { type: 'array', description: 'Issues' },
        corrections: { type: 'array', description: 'Corrections' },
        readinessScore: { type: 'number', description: 'Readiness score' },
      },
      dependencies: ['optimize-seo'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'finalize-content',
      name: 'Finalize and Format',
      description: 'Apply final formatting and prepare for publication',
      role: 'worker',
      task: 'Finalize content',
      environment: {},
      inputs: {
        content: { type: 'string', description: 'Content' },
        format: { type: 'string', description: 'Format' },
      },
      outputs: {
        finalContent: { type: 'string', description: 'Final content' },
        publishReady: { type: 'boolean', description: 'Ready to publish' },
        metadata: { type: 'object', description: 'Metadata' },
      },
      dependencies: ['technical-review'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  edges: [
    { from: 'analyze-brief', to: 'research-topic' },
    { from: 'research-topic', to: 'write-draft' },
    { from: 'write-draft', to: 'optimize-seo' },
    { from: 'optimize-seo', to: 'technical-review' },
    { from: 'technical-review', to: 'finalize-content' },
  ],
  executionOrder: [
    'analyze-brief',
    'research-topic',
    'write-draft',
    'optimize-seo',
    'technical-review',
    'finalize-content',
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load example workflow by ID
 */
export function getExampleWorkflow(workflowId: string): Workflow | null {
  const workflows: Record<string, Workflow> = {
    'travel-agent-workflow': travelAgentWorkflow,
    'data-analysis-workflow': dataAnalysisWorkflow,
    'content-creation-workflow': contentCreationWorkflow,
  };

  return workflows[workflowId] || null;
}

/**
 * List all available example workflows
 */
export function listExampleWorkflows(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return [
    {
      id: travelAgentWorkflow.id,
      name: travelAgentWorkflow.name,
      description: travelAgentWorkflow.description,
    },
    {
      id: dataAnalysisWorkflow.id,
      name: dataAnalysisWorkflow.name,
      description: dataAnalysisWorkflow.description,
    },
    {
      id: contentCreationWorkflow.id,
      name: contentCreationWorkflow.name,
      description: contentCreationWorkflow.description,
    },
  ];
}
