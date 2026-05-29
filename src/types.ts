/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MeetingSummaryRequest {
  transcript: string;
  templateType: 'general' | 'detailed' | 'action_items' | 'qa_only';
  targetLanguage: string; // 'none' for original, or 'en', 'ja', 'ko', etc.
}

export interface MeetingSummaryResponse {
  success: boolean;
  summaryMarkdown: string;
  translationMarkdown?: string;
  error?: string;
  metadata?: {
    wordCount: number;
    processingTimeMs: number;
    title?: string;
  };
}

export interface HistoryItem {
  id: string;
  timestamp: string; // ISO string
  title: string;
  originalTranscript: string;
  templateType: 'general' | 'detailed' | 'action_items' | 'qa_only';
  targetLanguage: string;
  summaryMarkdown: string;
  translationMarkdown?: string;
}

export interface SampleTranscript {
  title: string;
  description: string;
  content: string;
}
