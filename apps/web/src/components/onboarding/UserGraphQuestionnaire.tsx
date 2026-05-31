'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type {
  UserGraphPayload,
  LifeVisionHorizon,
  ConstraintDimension,
  DecisionAxis,
  CommitmentDomain,
  RiskDomain,
} from '@/types/user-graph';
import { EMPTY_USER_GRAPH_PAYLOAD } from '@/types/user-graph';

interface UserGraphQuestionnaireProps {
  data: UserGraphPayload;
  onChange: (data: UserGraphPayload) => void;
  onNext: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const SUB_STEPS = [
  'life_vision',
  'constraints',
  'decision_preferences',
  'commitment',
  'domain_risk',
  'motivation',
] as const;
type SubStep = (typeof SUB_STEPS)[number];

const HORIZON_LABELS: Record<LifeVisionHorizon, string> = {
  '1_year': 'In 1 year, what does success look like?',
  '3_year': 'In 3 years?',
  '5_year': 'In 5 years?',
  '10_year': 'In 10 years?',
  definition_of_success: 'How do you personally define success?',
  fears_to_avoid: 'What outcomes do you most want to avoid?',
};

const CONSTRAINT_DIMENSIONS: { value: ConstraintDimension; label: string; placeholder: string }[] =
  [
    {
      value: 'time',
      label: 'Time',
      placeholder: 'e.g. Only 5 hours per week to focus on long-term goals',
    },
    {
      value: 'money',
      label: 'Money',
      placeholder: 'e.g. Cannot reduce monthly cash flow below $X',
    },
    {
      value: 'health',
      label: 'Health',
      placeholder: 'e.g. Chronic back pain limits intense workouts',
    },
    { value: 'family', label: 'Family', placeholder: 'e.g. Need to stay close to aging parents' },
    {
      value: 'geography',
      label: 'Geography',
      placeholder: 'e.g. Cannot relocate outside the Southeast',
    },
    { value: 'other', label: 'Other', placeholder: 'Anything else that bounds your decisions' },
  ];

const DECISION_AXES: { value: DecisionAxis; label: string; help: string }[] = [
  { value: 'speed', label: 'Maximize Speed', help: 'Get to an outcome as quickly as possible.' },
  {
    value: 'certainty',
    label: 'Maximize Certainty',
    help: 'Prefer high-probability outcomes, even if smaller.',
  },
  {
    value: 'flexibility',
    label: 'Maximize Flexibility',
    help: 'Preserve future options as much as possible.',
  },
  {
    value: 'upside',
    label: 'Maximize Upside',
    help: 'Accept variance for a shot at outsized outcomes.',
  },
];

const COMMITMENT_DOMAINS: { value: CommitmentDomain; label: string }[] = [
  { value: 'overall', label: 'Overall (across all domains)' },
  { value: 'financial', label: 'Financial' },
  { value: 'career', label: 'Career' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'family', label: 'Family' },
];

const RISK_DOMAINS: { value: RiskDomain; label: string }[] = [
  { value: 'financial', label: 'Financial' },
  { value: 'career', label: 'Career' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'entrepreneurship', label: 'Entrepreneurship' },
];

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export default function UserGraphQuestionnaire({
  data,
  onChange,
  onNext,
  onBack,
  isSubmitting = false,
}: UserGraphQuestionnaireProps) {
  const [subStep, setSubStep] = useState<SubStep>('life_vision');
  const [local, setLocal] = useState<UserGraphPayload>({
    ...EMPTY_USER_GRAPH_PAYLOAD,
    ...data,
  });

  useEffect(() => {
    onChange(local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  const subStepIndex = SUB_STEPS.indexOf(subStep);
  const isLastSubStep = subStepIndex === SUB_STEPS.length - 1;

  // ---- Helpers ---------------------------------------------------------

  const setLifeVision = (horizon: LifeVisionHorizon, text: string) => {
    setLocal((prev) => {
      const others = prev.life_vision.filter((v) => v.horizon !== horizon);
      const next = text.trim().length ? [...others, { horizon, vision_text: text }] : others;
      return { ...prev, life_vision: next };
    });
  };

  const lifeVisionValue = (horizon: LifeVisionHorizon) =>
    local.life_vision.find((v) => v.horizon === horizon)?.vision_text ?? '';

  const addConstraint = (dimension: ConstraintDimension) => {
    setLocal((prev) => ({
      ...prev,
      constraints: [...prev.constraints, { dimension, severity: 'soft', description: '' }],
    }));
  };

  const updateConstraint = (
    index: number,
    patch: Partial<UserGraphPayload['constraints'][number]>
  ) => {
    setLocal((prev) => ({
      ...prev,
      constraints: prev.constraints.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  };

  const removeConstraint = (index: number) => {
    setLocal((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((_, i) => i !== index),
    }));
  };

  const setDecisionPref = (axis: DecisionAxis, weight: number) => {
    setLocal((prev) => {
      const others = prev.decision_preferences.filter((p) => p.axis !== axis);
      return {
        ...prev,
        decision_preferences: [...others, { axis, weight: clamp01(weight) }],
      };
    });
  };

  const decisionPrefValue = (axis: DecisionAxis) =>
    local.decision_preferences.find((p) => p.axis === axis)?.weight ?? 0.5;

  const setCommitment = (
    domain: CommitmentDomain,
    patch: Partial<UserGraphPayload['commitment_levels'][number]>
  ) => {
    setLocal((prev) => {
      const existing = prev.commitment_levels.find((c) => c.domain === domain);
      const others = prev.commitment_levels.filter((c) => c.domain !== domain);
      const merged = { domain, ...existing, ...patch };
      return { ...prev, commitment_levels: [...others, merged] };
    });
  };

  const commitmentValue = (domain: CommitmentDomain) =>
    local.commitment_levels.find((c) => c.domain === domain);

  const setDomainRisk = (domain: RiskDomain, score: number) => {
    setLocal((prev) => {
      const others = prev.domain_risk_tolerance.filter((r) => r.domain !== domain);
      return {
        ...prev,
        domain_risk_tolerance: [...others, { domain, tolerance_score: clamp01(score) }],
      };
    });
  };

  const domainRiskValue = (domain: RiskDomain) =>
    local.domain_risk_tolerance.find((r) => r.domain === domain)?.tolerance_score ?? 0.5;

  const addMotivation = () => {
    setLocal((prev) => ({
      ...prev,
      motivations: [...prev.motivations, { motivation_text: '', intensity: 5 }],
    }));
  };

  const updateMotivation = (
    index: number,
    patch: Partial<UserGraphPayload['motivations'][number]>
  ) => {
    setLocal((prev) => ({
      ...prev,
      motivations: prev.motivations.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  };

  const removeMotivation = (index: number) => {
    setLocal((prev) => ({
      ...prev,
      motivations: prev.motivations.filter((_, i) => i !== index),
    }));
  };

  // Ensure motivations seeded with one empty row when entering that sub-step.
  useEffect(() => {
    if (subStep === 'motivation' && local.motivations.length === 0) {
      addMotivation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subStep]);

  // ---- Navigation ------------------------------------------------------

  const goNextSubStep = () => {
    if (isLastSubStep) {
      onNext();
    } else {
      setSubStep(SUB_STEPS[subStepIndex + 1]);
    }
  };

  const goPrevSubStep = () => {
    if (subStepIndex === 0) {
      onBack();
    } else {
      setSubStep(SUB_STEPS[subStepIndex - 1]);
    }
  };

  const subStepLabel = useMemo<Record<SubStep, string>>(
    () => ({
      life_vision: 'Life Vision',
      constraints: 'Constraints',
      decision_preferences: 'Decision Preferences',
      commitment: 'Commitment',
      domain_risk: 'Risk Tolerance',
      motivation: 'Motivation',
    }),
    []
  );

  // ---- Render ----------------------------------------------------------

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          A few more things about you
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          These answers help the Navigator personalize recommendations. Anything here is optional —
          feel free to skip what doesn't apply.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Sub-step navigation">
        {SUB_STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setSubStep(s)}
            className={[
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              s === subStep
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            {i + 1}. {subStepLabel[s]}
          </button>
        ))}
      </nav>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-5">
        {subStep === 'life_vision' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Sketch where you'd like to be at each horizon. A sentence or two is enough.
            </p>
            {(Object.keys(HORIZON_LABELS) as LifeVisionHorizon[]).map((h) => (
              <div key={h}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {HORIZON_LABELS[h]}
                </label>
                <textarea
                  value={lifeVisionValue(h)}
                  onChange={(e) => setLifeVision(h, e.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {subStep === 'constraints' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              List the boundaries the Navigator should respect. Pick a dimension to add.
            </p>
            <div className="flex flex-wrap gap-2">
              {CONSTRAINT_DIMENSIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => addConstraint(d.value)}
                  className="px-3 py-1 rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  + {d.label}
                </button>
              ))}
            </div>
            <ul className="space-y-3">
              {local.constraints.map((c, i) => {
                const meta = CONSTRAINT_DIMENSIONS.find((x) => x.value === c.dimension);
                return (
                  <li
                    key={i}
                    className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        {meta?.label ?? c.dimension}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeConstraint(i)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={c.description}
                      onChange={(e) => updateConstraint(i, { description: e.target.value })}
                      rows={2}
                      placeholder={meta?.placeholder}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 text-sm"
                    />
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        <input
                          type="radio"
                          checked={c.severity === 'soft'}
                          onChange={() => updateConstraint(i, { severity: 'soft' })}
                        />
                        Soft (preference)
                      </label>
                      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        <input
                          type="radio"
                          checked={c.severity === 'hard'}
                          onChange={() => updateConstraint(i, { severity: 'hard' })}
                        />
                        Hard (must respect)
                      </label>
                    </div>
                  </li>
                );
              })}
              {local.constraints.length === 0 && (
                <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No constraints added yet — that's fine, you can add some later.
                </li>
              )}
            </ul>
          </div>
        )}

        {subStep === 'decision_preferences' && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              When the Navigator has to trade off between two acceptable options, what should it
              favor? Slide each axis from 0 (don't care) to 1 (top priority).
            </p>
            {DECISION_AXES.map((axis) => (
              <div key={axis.value}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {axis.label}
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.round(decisionPrefValue(axis.value) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={decisionPrefValue(axis.value)}
                  onChange={(e) => setDecisionPref(axis.value, Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{axis.help}</p>
              </div>
            ))}
          </div>
        )}

        {subStep === 'commitment' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Realistically, how much time and energy can you invest right now in each area? The
              Navigator uses this to size recommendations to your capacity.
            </p>
            {COMMITMENT_DOMAINS.map((d) => {
              const cur = commitmentValue(d.value);
              return (
                <div
                  key={d.value}
                  className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2"
                >
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-100">
                    {d.label}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      Hours / week:
                      <input
                        type="number"
                        min={0}
                        max={168}
                        step={1}
                        value={cur?.hours_per_week ?? ''}
                        onChange={(e) =>
                          setCommitment(d.value, {
                            hours_per_week: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-1 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      Energy:
                      <select
                        value={cur?.energy_level ?? ''}
                        onChange={(e) =>
                          setCommitment(d.value, {
                            energy_level:
                              (e.target.value as 'low' | 'medium' | 'high' | '') || null,
                          })
                        }
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-1 text-sm"
                      >
                        <option value="">—</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {subStep === 'domain_risk' && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              How willing are you to take risk in each area? 0 = very conservative, 1 = very
              aggressive.
            </p>
            {RISK_DOMAINS.map((d) => (
              <div key={d.value}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {d.label}
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.round(domainRiskValue(d.value) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={domainRiskValue(d.value)}
                  onChange={(e) => setDomainRisk(d.value, Number(e.target.value))}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        )}

        {subStep === 'motivation' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              In your own words, what's driving you right now? List one or several reasons. These
              power explanations the Navigator gives you back.
            </p>
            <ul className="space-y-3">
              {local.motivations.map((m, i) => (
                <li
                  key={i}
                  className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2"
                >
                  <textarea
                    value={m.motivation_text}
                    onChange={(e) => updateMotivation(i, { motivation_text: e.target.value })}
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. I want financial independence so I can take a year off to be present with my kids."
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-2 text-sm"
                  />
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      Type:
                      <select
                        value={m.motivation_type ?? ''}
                        onChange={(e) =>
                          updateMotivation(i, {
                            motivation_type:
                              (e.target.value as
                                | 'intrinsic'
                                | 'extrinsic'
                                | 'values_based'
                                | 'identity'
                                | 'fear_based'
                                | '') || null,
                          })
                        }
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-1"
                      >
                        <option value="">—</option>
                        <option value="intrinsic">Intrinsic</option>
                        <option value="extrinsic">Extrinsic</option>
                        <option value="values_based">Values-based</option>
                        <option value="identity">Identity</option>
                        <option value="fear_based">Fear-based</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      Intensity (1–10):
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={m.intensity ?? ''}
                        onChange={(e) =>
                          updateMotivation(i, {
                            intensity: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-1"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeMotivation(i)}
                      className="text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addMotivation}
              className="text-sm text-blue-600 hover:underline"
            >
              + Add another
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={goPrevSubStep}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Back
        </button>
        <button
          type="button"
          onClick={goNextSubStep}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
        >
          {isLastSubStep ? (isSubmitting ? 'Saving…' : 'Continue') : 'Next'}
        </button>
      </div>
    </div>
  );
}
