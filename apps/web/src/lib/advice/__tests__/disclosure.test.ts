import { levelFromText, levelFromThemes } from '../disclosure';

describe('advice disclosure level', () => {
  describe('levelFromText', () => {
    it('returns none for empty / low-risk / discovery text', () => {
      expect(levelFromText('')).toBe('none');
      expect(levelFromText(null)).toBe('none');
      expect(levelFromText(undefined)).toBe('none');
      expect(levelFromText('What should I focus on this year?')).toBe('none');
      expect(levelFromText('I want to feel less stressed and spend time with family')).toBe('none');
    });

    it('returns subtle for general planning topics', () => {
      expect(levelFromText('I want to build a budget and pay down debt')).toBe('subtle');
      expect(levelFromText('How do my education and career goals line up?')).toBe('subtle');
      expect(levelFromText('What benefits should I use?')).toBe('subtle');
    });

    it('returns explicit for high-stakes financial/legal/medical topics', () => {
      expect(levelFromText('Should I move my 401k into an index ETF?')).toBe('explicit');
      expect(levelFromText('How should I structure my estate and beneficiaries?')).toBe('explicit');
      expect(levelFromText('What are the tax implications of selling stock?')).toBe('explicit');
      expect(levelFromText('I need to review my life insurance')).toBe('explicit');
      expect(levelFromText('My doctor mentioned a new medication')).toBe('explicit');
    });

    it('lets EXPLICIT win when both tiers match', () => {
      // "save" (subtle) + "tax" (explicit) → explicit
      expect(levelFromText('How do I save on taxes?')).toBe('explicit');
    });

    it('uses word boundaries (no false trigger on substrings)', () => {
      // "irate" must not match "ira"; "save" should still match as a whole word elsewhere
      expect(levelFromText('I was irate about the service')).toBe('none');
    });
  });

  describe('levelFromThemes', () => {
    it('returns none for empty themes', () => {
      expect(levelFromThemes([])).toBe('none');
      expect(levelFromThemes(null)).toBe('none');
      expect(levelFromThemes([null, undefined])).toBe('none');
    });

    it('escalates from advisor context-panel themes/risks', () => {
      expect(levelFromThemes(['family time', 'work-life balance'])).toBe('none');
      expect(levelFromThemes(['emergency fund', 'budgeting'])).toBe('subtle');
      expect(levelFromThemes(['retirement readiness', 'estate planning'])).toBe('explicit');
    });
  });
});
