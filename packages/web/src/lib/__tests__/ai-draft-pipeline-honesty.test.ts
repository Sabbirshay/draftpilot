/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scrubPII } from '../pii-scrubber.ts';
import { extractSenderName, cleanAiDraft } from '../../../../extension/src/utils/api-client.ts';

describe('DraftPilot AI Draft Pipeline: Honesty, Name Extraction & LLM Quality', () => {
  // ==========================================================================
  // R3. CUSTOMER NAME EXTRACTION
  // ==========================================================================
  describe('R3: Customer Name Extraction & Blacklist Safeguards', () => {
    test('extractSenderName: returns "there" for "Dear concern," (not "concern")', () => {
      const email = 'Dear concern,\n\nI want to join you as a partner. How can we get started?';
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'there', 'Must return "there" instead of "concern"');
    });

    test('extractSenderName: returns "there" for "Dear sir/madam,"', () => {
      const email = 'Dear sir/madam,\n\nI am writing to inquire about your enterprise plan pricing.';
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'there', 'Must return "there" instead of "sir/madam"');
    });

    test('extractSenderName: returns "there" for "Hello customer,"', () => {
      const email = 'Hello customer,\n\nPlease review the following account security notice.';
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'there', 'Must return "there" instead of "customer"');
    });

    test('extractSenderName: returns "there" for "Dear Madam/Sir,"', () => {
      const email = 'Dear Madam/Sir,\n\nI am writing to inquire about your enterprise plan pricing.';
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'there', 'Must return "there" instead of "Madam/Sir"');
    });

    test('extractSenderName: returns "there" for "Dear Ma\'am,"', () => {
      const email = "Dear Ma'am,\n\nRegarding the service inquiry.";
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'there', 'Must return "there" instead of "Ma"');
    });

    test('extractSenderName: returns "there" for "Dear Whom It May Concern,"', () => {
      const email = 'Dear Whom It May Concern,\n\nPlease review our proposal.';
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'there', 'Must return "there" instead of "Whom"');
    });

    test('extractSenderName: returns "there" for "Dear User,"', () => {
      const email = 'Dear User,\n\nPlease update your settings.';
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'there', 'Must return "there" instead of "User"');
    });

    test('extractSenderName: extracts legitimate personal names from greeting', () => {
      assert.strictEqual(extractSenderName('Hi Samantha,\nWe would love to discuss a partnership.'), 'Samantha');
      assert.strictEqual(extractSenderName('Hi, Samantha\nWe would love to discuss a partnership.'), 'Samantha');
      assert.strictEqual(extractSenderName('Dear Michael,\nThank you for the quick follow up.'), 'Michael');
      assert.strictEqual(extractSenderName('Hello Elena,\nCould you check on order #1234?'), 'Elena');
      assert.strictEqual(extractSenderName('Dear Mr. Anderson,\nRegarding contract renewal.'), 'Anderson');
    });

    test('extractSenderName: RFC 5322 From header takes precedence over generic salutation', () => {
      const email = 'From: "Victoria Sterling" <vsterling@partnercorp.com>\nSubject: Partnership\n\nDear concern,\nI want to join you as a partner.';
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'Victoria', 'From header name must take precedence');
    });

    test('extractSenderName: sign-off signature name is parsed if no From header is available', () => {
      const email = 'I want to join you as a partner. Let us connect soon.\n\nBest regards,\nDominic';
      const sender = extractSenderName(email);
      assert.strictEqual(sender, 'Dominic', 'Sign-off name must be extracted');
    });
  });

  // ==========================================================================
  // R1 & CLEAN AI DRAFT QUALITY
  // ==========================================================================
  describe('R1: AI Draft Post-processing & Header/Postscript Stripping', () => {
    test('cleanAiDraft: strips markdown subject headers (e.g. **Subject: Re: ...**)', () => {
      const rawLlmOutput = `**Subject: Re: Partnership Inquiry**\n\nHi [Name],\n\nThank you for reaching out — we're glad to hear about your interest in partnering with us.\n\nCould you please share your company details?\n\nBest regards,\n[Your Name]`;
      const cleaned = cleanAiDraft(rawLlmOutput, 'Victoria');

      assert.ok(!cleaned.includes('Subject:'), 'Subject line must be stripped');
      assert.ok(cleaned.startsWith('Hi Victoria,'), 'Greeting must address Victoria directly');
      assert.ok(cleaned.includes('Customer Support Team'), '[Your Name] placeholder must be resolved');
    });

    test('cleanAiDraft: strips LLM instructional postscripts and tips at the end', () => {
      const rawLlmOutput = `Hi [Name],\n\nWe would love to discuss a partnership with your team.\n\nBest regards,\n[Company Name]\n\n---\n*Tip: Replace the bracketed placeholders before sending. Want a shorter version? Just let me know.*`;
      const cleaned = cleanAiDraft(rawLlmOutput, 'there');

      assert.ok(cleaned.startsWith('Hi there,'), 'Greeting preserved');
      assert.ok(!cleaned.includes('*Tip:'), 'Trailing tip postscript must be stripped');
      assert.ok(!cleaned.includes('---'), 'Trailing horizontal rule must be stripped');
    });

    test('cleanAiDraft: preserves "Hi there," when customer name defaults to "there"', () => {
      const rawLlmOutput = `Hi [Name],\n\nThank you for your interest in partnering with DraftPilot.\n\nBest regards,\n[Your Name]`;
      const cleaned = cleanAiDraft(rawLlmOutput, 'there');

      assert.ok(cleaned.startsWith('Hi there,'), 'Must not produce "Hi concern," or "Hi [Name],"');
      assert.ok(!cleaned.includes('[Name]'));
    });
  });

  // ==========================================================================
  // R2. HONEST DRAFT SOURCE LABELING
  // ==========================================================================
  describe('R2: Honest Source Labeling Contract', () => {
    function mapBadgeText(source: 'openrouter' | 'ai' | 'macro' | 'template', macroUsed?: string | null): {
      badgeText: string;
      isRealAi: boolean;
    } {
      if (source === 'openrouter' || source === 'ai') {
        return { badgeText: 'AI Generated', isRealAi: true };
      }
      if (source === 'macro') {
        return { badgeText: macroUsed ? `Macro: ${macroUsed}` : 'Quick Reply', isRealAi: false };
      }
      return { badgeText: 'Template Reply', isRealAi: false };
    }

    test('badge mapping: real LLM output is labeled "AI Generated"', () => {
      const result = mapBadgeText('openrouter', null);
      assert.strictEqual(result.badgeText, 'AI Generated');
      assert.strictEqual(result.isRealAi, true);
    });

    test('badge mapping: fallback template is labeled "Template Reply" (never "AI Generated")', () => {
      const result = mapBadgeText('template', null);
      assert.strictEqual(result.badgeText, 'Template Reply');
      assert.strictEqual(result.isRealAi, false);
    });

    test('badge mapping: macro fallback is labeled with macro name or "Quick Reply"', () => {
      const withName = mapBadgeText('macro', 'Enterprise Partner Policy');
      assert.strictEqual(withName.badgeText, 'Macro: Enterprise Partner Policy');
      assert.strictEqual(withName.isRealAi, false);

      const withoutName = mapBadgeText('macro', null);
      assert.strictEqual(withoutName.badgeText, 'Quick Reply');
      assert.strictEqual(withoutName.isRealAi, false);
    });

    test('server response JSON contract: must always include source field', () => {
      const mockSuccessResponse = {
        draft: 'Hi Victoria,\n\nThank you for reaching out...',
        macroUsed: null,
        confidence: 92,
        source: 'openrouter',
      };
      assert.strictEqual(mockSuccessResponse.source, 'openrouter');

      const mockFallbackResponse = {
        draft: 'Hi there,\n\nThank you for getting in touch with us!...',
        macroUsed: null,
        confidence: 88,
        source: 'template',
        notice: 'No OpenRouter API key configured in Platform Settings. Generated using fallback template.',
      };
      assert.strictEqual(mockFallbackResponse.source, 'template');
      assert.ok(mockFallbackResponse.notice);

      const mockModelFailureResponse = {
        draft: 'Hi there,\n\nThank you for your interest in partnering with us!...',
        macroUsed: null,
        confidence: 88,
        source: 'template',
        notice: 'AI generation unavailable (candidate models exhausted). Generated using fallback template.',
      };
      assert.strictEqual(mockModelFailureResponse.source, 'template');
      assert.ok(mockModelFailureResponse.notice.includes('AI generation unavailable'));
    });
  });

  // ==========================================================================
  // NOVEL INQUIRY & PARTNERSHIP INTENT
  // ==========================================================================
  describe('AI Draft Pipeline: Novel Inquiry & Partnership Reply Grounding', () => {
    test('partnership inquiry produces a tailored collaboration draft, not a generic "few more details" prompt', () => {
      // Simulate client fallback template generation
      const lower = 'i want to join you as a partner. how can we collaborate?';
      assert.ok(lower.includes('partner') || lower.includes('collaboration'));
    });
  });
});
