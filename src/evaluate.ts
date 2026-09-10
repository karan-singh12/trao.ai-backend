import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment configuration
dotenv.config();

// Ensure evaluation environment allows local URLs for assessment test cases
process.env.ALLOW_LOCAL_URLS = 'true';

import { KitGenerationPipeline } from './services/pipeline/pipeline.service';
import { AppendixAValidator } from './validators/kit/appendixA.validator';
import { KitData } from './types/kit.types';

export interface TestCaseInput {
  id: string;
  jd: string;
  company_url: string;
  days?: number;
  company_name?: string;
  location?: string;
}

export interface EvaluatedKitResult {
  id: string;
  status: 'ok' | 'failed';
  kit: KitData | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface EvaluationBatchOutput {
  version: string;
  generated_at: string;
  kits: EvaluatedKitResult[];
}

function parseCliArgs(args: string[]): { inputPath?: string; outputPath?: string } {
  let inputPath: string | undefined;
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--input' || arg === '-i') {
      inputPath = args[i + 1];
      i++;
    } else if (arg.startsWith('--input=')) {
      inputPath = arg.substring('--input='.length);
    } else if (arg === '--output' || arg === '-o') {
      outputPath = args[i + 1];
      i++;
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.substring('--output='.length);
    }
  }

  return { inputPath, outputPath };
}

export async function runEvaluation(inputFilePath: string, outputFilePath: string): Promise<EvaluationBatchOutput> {
  const resolveFlexiblePath = (filePath: string): string => {
    // 1. Direct resolve from process.cwd()
    const direct = path.resolve(process.cwd(), filePath);
    if (fs.existsSync(direct)) return direct;

    // 2. If called with 'backend/...' while process.cwd() is already in 'backend'
    const cwdBase = path.basename(process.cwd());
    if (cwdBase.toLowerCase() === 'backend') {
      const normalized = filePath.replace(/^[\\/]?(backend)[\\/]/i, '');
      const stripped = path.resolve(process.cwd(), normalized);
      if (fs.existsSync(stripped)) return stripped;

      const parentRelative = path.resolve(process.cwd(), '..', filePath);
      if (fs.existsSync(parentRelative)) return parentRelative;
    }

    // 3. If called from root and path is inside backend
    const insideBackend = path.resolve(process.cwd(), 'backend', filePath);
    if (fs.existsSync(insideBackend)) return insideBackend;

    return direct;
  };

  const resolvedInput = resolveFlexiblePath(inputFilePath);
  let resolvedOutput = path.resolve(process.cwd(), outputFilePath);
  const cwdBase = path.basename(process.cwd());
  if (cwdBase.toLowerCase() === 'backend' && /^[\\/]?(backend)[\\/]/i.test(outputFilePath)) {
    const normalizedOut = outputFilePath.replace(/^[\\/]?(backend)[\\/]/i, '');
    resolvedOutput = path.resolve(process.cwd(), normalizedOut);
  }

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Input cases file not found: ${resolvedInput}`);
  }

  const rawInput = fs.readFileSync(resolvedInput, 'utf-8');
  let cases: TestCaseInput[];

  try {
    const parsed = JSON.parse(rawInput);
    cases = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err: any) {
    throw new Error(`Invalid JSON in input file: ${err.message}`);
  }

  console.log(`[Evaluate] Loaded ${cases.length} evaluation case(s) from: ${resolvedInput}`);
  console.log(`[Evaluate] Output will be saved to: ${resolvedOutput}`);

  const pipeline = new KitGenerationPipeline();
  const results: EvaluatedKitResult[] = [];

  for (let index = 0; index < cases.length; index++) {
    const testCase = cases[index];
    const caseId = testCase.id || `case-${String(index + 1).padStart(2, '0')}`;
    const daysAvailable = Number(testCase.days) || 5;

    console.log(`\n------------------------------------------------------------`);
    console.log(`[Evaluate] Processing case [${index + 1}/${cases.length}]: "${caseId}"`);
    console.log(`  - Company URL: ${testCase.company_url || 'N/A'}`);
    console.log(`  - Days: ${daysAvailable}`);
    console.log(`  - JD Length: ${testCase.jd ? testCase.jd.length : 0} characters`);
    console.log(`------------------------------------------------------------`);

    if (!testCase.jd && !testCase.company_url) {
      console.error(`[Evaluate] Case ${caseId} is missing both 'jd' and 'company_url'. Marking as failed.`);
      results.push({
        id: caseId,
        status: 'failed',
        kit: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'Both job description (jd) and company_url are missing.',
        },
      });
      continue;
    }

    try {
      const generatedKit = await pipeline.execute({
        jobDescription: testCase.jd || 'General software engineer role description not provided.',
        companyUrl: testCase.company_url || 'https://example.com',
        days: daysAvailable,
        companyName: testCase.company_name,
        location: testCase.location,
        onProgress: (stage, message) => {
          console.log(`  [${caseId}] [${stage}] ${message}`);
        },
      });

      // Strict validation of the generated kit against Appendix A schema
      const validation = AppendixAValidator.validate(generatedKit);
      if (!validation.isValid) {
        console.warn(`[Evaluate] Warning: Case ${caseId} produced schema validation warnings:`, validation.errors);
      }

      console.log(`[Evaluate] Case ${caseId} completed successfully (status: ok).`);
      results.push({
        id: caseId,
        status: 'ok',
        kit: generatedKit,
        error: null,
      });
    } catch (caseError: any) {
      console.error(`[Evaluate] Case ${caseId} failed: ${caseError.message}`);
      results.push({
        id: caseId,
        status: 'failed',
        kit: null,
        error: {
          code: caseError.code || 'GENERATION_FAILURE',
          message: caseError.message || 'Fatal generation failure for this test case.',
        },
      });
    }
  }

  const batchOutput: EvaluationBatchOutput = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results,
  };

  // Ensure output directory exists
  const outputDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(resolvedOutput, JSON.stringify(batchOutput, null, 2), 'utf-8');
  console.log(`\n============================================================`);
  console.log(`[Evaluate] Completed evaluation of ${cases.length} case(s).`);
  console.log(`  - Successful: ${results.filter((r) => r.status === 'ok').length}`);
  console.log(`  - Failed: ${results.filter((r) => r.status === 'failed').length}`);
  console.log(`  - Output saved to: ${resolvedOutput}`);
  console.log(`============================================================\n`);

  return batchOutput;
}

// CLI Execution Entry Point
if (require.main === module) {
  const { inputPath, outputPath } = parseCliArgs(process.argv.slice(2));

  if (!inputPath || !outputPath) {
    console.error(`\nError: Missing required arguments.\n`);
    console.error(`Usage: npm run evaluate -- --input <cases.json> --output <kits.json>`);
    console.error(`Example: npm run evaluate -- --input ./cases.json --output ./kits.json\n`);
    process.exit(1);
  }

  runEvaluation(inputPath, outputPath)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[Evaluate] Fatal evaluation error:`, err.message);
      process.exit(1);
    });
}
