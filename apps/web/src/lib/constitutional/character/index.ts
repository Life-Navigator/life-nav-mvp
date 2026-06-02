/**
 * Constitutional Character Layer — entry.
 */

export * from './types';
export { CHARACTER_PRINCIPLES, CHARACTER_PRINCIPLE_INDEX, ADVISOR_ARCHETYPES } from './principles';
export type { CharacterPrincipleDef } from './principles';
export { scanStyle } from './style-guard';
export type { StyleScanResult } from './style-guard';
export { familyTableTest } from './family-table';
export type { FamilyTableInputs } from './family-table';
export { trustedAdvisorTest } from './trusted-advisor';
export type { TrustedAdvisorInputs } from './trusted-advisor';
export { flourishingReview } from './flourishing-review';
export type { FlourishingInputs } from './flourishing-review';
export { scoreCharacter } from './character-scorer';
export type { ScoreInputs as CharacterScoreInputs } from './character-scorer';
export { composeConstructiveGuidance } from './constructive-guidance';
export type {
  ConstructiveGuidance,
  ConstructiveGuidanceInputs,
  RefusalCategory,
} from './constructive-guidance';
export { reviewCharacter } from './character-engine';
export type { CharacterReviewInputs } from './character-engine';
