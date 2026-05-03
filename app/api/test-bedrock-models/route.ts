import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';

// List of Bedrock models to test
const MODELS_TO_TEST = [
  'bedrock/us.amazon.nova-pro-v1:0',
  'bedrock/us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'bedrock/us.anthropic.claude-3-haiku-20240307-v1:0',
  'bedrock/us.moonshotai.kimi-k2.5',
  'bedrock/anthropic.claude-3-sonnet-20240229-v1:0',
];

export async function GET(req: NextRequest) {
  try {
    console.log('[Test Bedrock] Starting model compatibility test...');
    
    const results = {
      timestamp: new Date().toISOString(),
      models: [] as Array<{
        model: string;
        status: 'success' | 'error';
        message?: string;
        latency?: number;
      }>,
      recommendations: [] as string[]
    };

    // Test each model
    for (const modelId of MODELS_TO_TEST) {
      const startTime = Date.now();
      try {
        console.log(`[Test Bedrock] Testing model: ${modelId}`);
        
        const model = bedrock(modelId);
        
        const response = await generateText({
          model,
          prompt: 'Say only the word "working" and nothing else.',
        });

        const latency = Date.now() - startTime;
        
        results.models.push({
          model: modelId,
          status: 'success',
          message: response.text.trim(),
          latency,
        });
        
        console.log(`[Test Bedrock] ✅ ${modelId} - WORKING (${latency}ms)`);
      } catch (error: any) {
        const latency = Date.now() - startTime;
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        
        results.models.push({
          model: modelId,
          status: 'error',
          message: errorMsg,
          latency,
        });
        
        console.error(`[Test Bedrock] ❌ ${modelId} - ERROR: ${errorMsg}`);
      }
    }

    // Analyze results and provide recommendations
    const workingModels = results.models.filter(m => m.status === 'success');
    const failedModels = results.models.filter(m => m.status === 'error');

    console.log(`[Test Bedrock] Results: ${workingModels.length} working, ${failedModels.length} failed`);

    if (workingModels.length === 0) {
      results.recommendations.push('❌ No Bedrock models are accessible. Check AWS credentials and model access.');
    } else {
      // Find the best model based on speed and model preference
      const fastestModel = workingModels.reduce((a, b) => 
        (a.latency || 0) < (b.latency || 0) ? a : b
      );
      
      // Rank models by preference
      let recommendedModel = workingModels[0];
      
      // Prefer Claude for reasoning
      const claudeModel = workingModels.find(m => m.model.includes('claude'));
      if (claudeModel) {
        recommendedModel = claudeModel;
        results.recommendations.push(`✅ Using ${recommendedModel.model} (Claude available)`);
      } else {
        // Fall back to fastest model
        recommendedModel = fastestModel;
        results.recommendations.push(`✅ Using ${recommendedModel.model} (fastest: ${recommendedModel.latency}ms)`);
      }
      
      // Show all working models
      workingModels.forEach(m => {
        results.recommendations.push(`   • ${m.model} ✓ (${m.latency}ms)`);
      });
      
      // Show failed models
      if (failedModels.length > 0) {
        results.recommendations.push(`\n❌ Failed models:`);
        failedModels.forEach(m => {
          const errorSnippet = m.message?.substring(0, 50) || 'Unknown error';
          results.recommendations.push(`   • ${m.model} - ${errorSnippet}`);
        });
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[Test Bedrock] Fatal error:', error);
    return NextResponse.json({
      error: 'Test failed',
      message: error?.message || 'Unknown error',
      details: error?.toString()
    }, { status: 500 });
  }
}
