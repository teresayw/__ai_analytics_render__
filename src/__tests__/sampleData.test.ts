import { describe, expect, it } from 'vitest';
import { SAMPLE_TRANSCRIPTS } from '../sampleData';

describe('SAMPLE_TRANSCRIPTS', () => {
  it('should contain at least one sample transcript', () => {
    expect(SAMPLE_TRANSCRIPTS.length).toBeGreaterThan(0);
  });

  it('should have title and content for each sample', () => {
    SAMPLE_TRANSCRIPTS.forEach((sample) => {
      expect(sample.title).toBeTruthy();
      expect(sample.content).toBeTruthy();
    });
  });
});
