/**
 * @jest-environment node
 *
 * Feedback validators + NPS bucketing.
 */

import { __test } from '../service';

const {
  validateRecommendationFeedback,
  validateSimulationFeedback,
  validateNps,
  validateBugReport,
  npsBucket,
} = __test;

describe('validateRecommendationFeedback', () => {
  test('happy', () => {
    expect(validateRecommendationFeedback({ feedback_kind: 'helpful' }).ok).toBe(true);
  });
  test('invalid kind rejected', () => {
    expect(validateRecommendationFeedback({ feedback_kind: 'bogus' as any }).ok).toBe(false);
  });
  test('long comment rejected', () => {
    expect(
      validateRecommendationFeedback({
        feedback_kind: 'helpful',
        comment: 'x'.repeat(4001),
      }).ok
    ).toBe(false);
  });
});

describe('validateNps', () => {
  test.each([
    [0, true],
    [5, true],
    [10, true],
    [-1, false],
    [11, false],
    [3.5, false],
  ])('score %s → ok=%s', (score, ok) => {
    expect(validateNps({ score }).ok).toBe(ok);
  });
});

describe('npsBucket', () => {
  test.each([
    [-1, 'invalid'],
    [0, 'detractor'],
    [6, 'detractor'],
    [7, 'passive'],
    [8, 'passive'],
    [9, 'promoter'],
    [10, 'promoter'],
    [11, 'invalid'],
  ])('score %s → %s', (score, bucket) => {
    expect(npsBucket(score)).toBe(bucket);
  });
});

describe('validateBugReport', () => {
  test('short title/body rejected', () => {
    expect(validateBugReport({ title: 'no', body: 'bad' }).ok).toBe(false);
  });
  test('happy path', () => {
    expect(
      validateBugReport({
        title: 'Login spinner stuck',
        body: 'After clicking Submit the spinner never stops on Safari 17.',
      }).ok
    ).toBe(true);
  });
  test('invalid severity rejected', () => {
    expect(
      validateBugReport({
        title: 'Login spinner stuck',
        body: 'Sufficient body text for validation.',
        severity: 'apocalyptic' as any,
      }).ok
    ).toBe(false);
  });
});

describe('validateSimulationFeedback', () => {
  test('useful is accepted', () => {
    expect(validateSimulationFeedback({ feedback_kind: 'useful' }).ok).toBe(true);
  });
});
