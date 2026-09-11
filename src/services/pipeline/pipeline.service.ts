import { KitData, KitSource } from '../../types/kit.types';
import { UrlValidator } from '../crawler/url.validator';
import { CompanyCrawler, CrawledCompanyData } from '../crawler/company.crawler';
import { DiscussionSearcher } from '../crawler/discussion.searcher';
import { RequirementExtractor } from './extractors/requirement.extractor';
import { CompanyBriefGenerator } from './generators/brief.generator';
import { QuestionGenerator } from './generators/question.generator';
import { FlashcardGenerator } from './generators/flashcard.generator';
import { SecondPassRunner } from './second.pass';
import { ScheduleEngine } from '../schedule/schedule.engine';
import { AppendixAValidator } from '../../validators/kit/appendixA.validator';

export interface GenerateKitOptions {
  jobDescription: string;
  companyUrl: string;
  days: number;
  companyName?: string;
  location?: string;
  onProgress?: (stage: string, message: string) => void;
}

export class KitGenerationPipeline {
  private requirementExtractor: RequirementExtractor;
  private companyCrawler: CompanyCrawler;
  private discussionSearcher: DiscussionSearcher;
  private briefGenerator: CompanyBriefGenerator;
  private questionGenerator: QuestionGenerator;
  private flashcardGenerator: FlashcardGenerator;
  private secondPassRunner: SecondPassRunner;

  constructor() {
    this.requirementExtractor = new RequirementExtractor();
    this.companyCrawler = new CompanyCrawler();
    this.discussionSearcher = new DiscussionSearcher();
    this.briefGenerator = new CompanyBriefGenerator();
    this.questionGenerator = new QuestionGenerator();
    this.flashcardGenerator = new FlashcardGenerator();
    this.secondPassRunner = new SecondPassRunner(this.questionGenerator);
  }

  async execute(options: GenerateKitOptions): Promise<KitData> {
    const { jobDescription, companyUrl, days, onProgress } = options;

    const reportProgress = (stage: string, message: string) => {
      console.log(`[Pipeline] [${stage}] ${message}`);
      if (onProgress) onProgress(stage, message);
    };

    // --- STEP 0: Sanitize Inputs ---
    reportProgress('VALIDATE', 'Validating inputs and normalizing company URL...');
    const urlValidation = UrlValidator.validate(companyUrl);
    const sanitizedUrl = urlValidation.isValid ? urlValidation.sanitizedUrl! : companyUrl;

    // Derive company name fallback from domain if not provided
    const inferredCompany =
      options.companyName ||
      urlValidation.parsedUrl?.hostname.replace(/^www\./, '').split('.')[0] ||
      'Company';
    const companyDisplayName =
      inferredCompany.charAt(0).toUpperCase() + inferredCompany.slice(1);

    // --- STEP 1: Grounded Requirement Extraction ---
    reportProgress('EXTRACT', 'Extracting grounded requirements and role structure from Job Description...');
    const roleInfo = await this.requirementExtractor.extract(jobDescription);

    // --- STEP 2: Intelligent Web Research & Crawling ---
    reportProgress('CRAWL', `Crawling ${sanitizedUrl} for company overview, hiring culture, and interviews...`);
    let crawledData: CrawledCompanyData;
    let discussionText = '';

    try {
      crawledData = await this.companyCrawler.crawl(sanitizedUrl);
    } catch (crawlErr: any) {
      console.warn('[Pipeline] Crawl encountered error, continuing gracefully:', crawlErr.message);
      crawledData = {
        reachable: false,
        pages_used: [],
        hiring_page_found: false,
        discussion_findings: null,
        combined_research_text: '',
        companyUrl: sanitizedUrl,
        pagesUsed: [],
        status: 'unreachable',
        error: { code: 'CRAWL_FAILED', message: crawlErr.message },
      };
    }

    try {
      const discussions = await this.discussionSearcher.search(
        companyDisplayName,
        roleInfo.title
      );
      discussionText = Array.isArray(discussions?.snippets)
        ? discussions.snippets.join('\n')
        : (discussions?.notes || '');
    } catch (discErr: any) {
      console.warn('[Pipeline] Discussion search skipped:', discErr.message);
    }

    // --- STEP 3: Synthesize Company Brief ---
    reportProgress('BRIEF', 'Synthesizing verified company brief and culture...');
    const companyBrief = await this.briefGenerator.generate(
      companyDisplayName,
      sanitizedUrl,
      crawledData,
      discussionText
    );

    // --- STEP 4: Initial Categorized Question Generation ---
    reportProgress('QUESTIONS', 'Generating categorized technical and behavioural questions...');
    const context = {
      companyName: companyDisplayName,
      roleTitle: roleInfo.title,
      hiringContext: crawledData.hiring_content || (crawledData as any).hiringContent || discussionText,
    };

    const initialQuestions = await this.questionGenerator.generateForRequirements(
      roleInfo.requirements,
      context,
      1
    );

    // --- STEP 5: Flashcard Generation ---
    reportProgress('FLASHCARDS', 'Building active-recall study flashcards...');
    const flashcards = await this.flashcardGenerator.generate(roleInfo.requirements);

    // --- STEP 6: Deterministic Second Pass Coverage Loop ---
    reportProgress('COVERAGE', 'Checking requirement coverage and executing Second Pass loop if gaps exist...');
    const secondPassResult = await this.secondPassRunner.run(
      roleInfo.requirements,
      initialQuestions,
      context
    );

    const finalQuestions = secondPassResult.questions;
    const finalCoverage = secondPassResult.coverage;

    // --- STEP 7: Deterministic Arithmetic Schedule Allocation ---
    reportProgress('SCHEDULE', `Allocating ${finalQuestions.length} questions across ${days} days...`);
    const schedule = ScheduleEngine.allocateSchedule(days, finalQuestions, roleInfo.requirements);

    // --- STEP 8: Construct Appendix A Kit & Validate ---
    reportProgress('VALIDATE_KIT', 'Validating assembled kit against Appendix A schema...');
    const pagesUsed = (crawledData as any).pages_used || (crawledData as any).pagesUsed || [];
    const targetLogoUrl =
      crawledData.logo_url ||
      `https://www.google.com/s2/favicons?domain=${urlValidation.parsedUrl?.hostname.replace(/^www\./, '') || 'example.com'}&sz=128`;

    const source: KitSource = {
      company: companyDisplayName,
      company_url: sanitizedUrl,
      role: roleInfo.title,
      location: options.location || 'Remote / Unspecified',
      jd_chars: jobDescription.length,
      researched_at: new Date().toISOString(),
      pages_used: pagesUsed,
      logo_url: targetLogoUrl,
    };

    const assembledKit: KitData = {
      source,
      company_brief: {
        ...companyBrief,
        logo_url: targetLogoUrl,
      },
      role: roleInfo,
      questions: finalQuestions,
      flashcards,
      schedule,
      coverage: finalCoverage,
    };

    // Run Appendix A validation
    const validationResult = AppendixAValidator.validate(assembledKit);
    if (!validationResult.isValid) {
      console.error('[Pipeline] Appendix A validation issues detected:', validationResult.errors);
      // Auto-remedy common arithmetic or structural edge cases if necessary
      assembledKit.coverage.passes = Math.max(1, Math.round(assembledKit.coverage.passes));
    }

    reportProgress('DONE', `Kit generation complete with ${assembledKit.questions.length} questions and ${assembledKit.coverage.passes} coverage pass(es).`);
    return assembledKit;
  }
}
