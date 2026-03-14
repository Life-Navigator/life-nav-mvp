'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import Link from 'next/link';

// Types
interface Resume {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
  targetJobTitle?: string;
  targetCompany?: string;
  atsScore?: number;
  status: string;
  version: number;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  websiteUrl?: string;
  summary?: string;
  experience?: WorkExperience[];
  education?: Education[];
  skills?: Record<string, string[]>;
  certifications?: Certification[];
  projects?: Project[];
  keywords?: string[];
}

interface WorkExperience {
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  bullets: string[];
}

interface Education {
  institution: string;
  degree?: string;
  major?: string;
  gpa?: number;
  startDate?: string;
  endDate?: string;
}

interface Certification {
  name: string;
  issuer: string;
  date?: string;
  url?: string;
}

interface Project {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

interface GenerateInsights {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

// Icons
function DocumentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

function StarIcon(props: React.SVGProps<SVGSVGElement> & { filled?: boolean }) {
  const { filled, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...rest}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

// Resume Card Component
function ResumeCard({
  resume,
  onDelete,
  onSetDefault,
  onSelect,
}: {
  resume: Resume;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onSelect: (resume: Resume) => void;
}) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(resume)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <DocumentIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
            {resume.name}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {resume.aiGenerated && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              <SparklesIcon className="w-3 h-3 mr-1" />
              AI
            </span>
          )}
          {resume.isDefault && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Default
            </span>
          )}
        </div>
      </div>

      {resume.targetJobTitle && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Target: {resume.targetJobTitle}
          {resume.targetCompany && ` at ${resume.targetCompany}`}
        </p>
      )}

      {resume.atsScore !== undefined && resume.atsScore !== null && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">ATS Score</span>
            <span
              className={`font-medium ${
                resume.atsScore >= 70
                  ? 'text-green-600'
                  : resume.atsScore >= 50
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
            >
              {resume.atsScore}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${
                resume.atsScore >= 70
                  ? 'bg-green-600'
                  : resume.atsScore >= 50
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
              }`}
              style={{ width: `${resume.atsScore}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          v{resume.version} - {resume.template}
        </span>
        <span>{new Date(resume.updatedAt).toLocaleDateString()}</span>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetDefault(resume.id);
          }}
          className={`p-1.5 rounded ${resume.isDefault ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
          title={resume.isDefault ? 'Default resume' : 'Set as default'}
        >
          <StarIcon className="w-4 h-4" filled={resume.isDefault} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(resume.id);
          }}
          className="p-1.5 rounded text-gray-400 hover:text-red-500"
          title="Delete resume"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// AI Generate Modal
function GenerateModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
}: {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: { jobTitle: string; jobDescription: string; company?: string }) => void;
  isGenerating: boolean;
}) {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [company, setCompany] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <SparklesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Generate AI-Optimized Resume
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Paste a job description to create a tailored resume
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Job Title *
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name (Optional)
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., Google, Microsoft, Startup Inc."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Description *
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here. The AI will analyze it to identify key skills, requirements, and keywords to optimize your resume for ATS systems..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => onGenerate({ jobTitle, jobDescription, company })}
              disabled={!jobTitle || !jobDescription || isGenerating}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Generate Resume
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Resume Editor/Preview Panel
function ResumeEditor({
  resume,
  onClose,
  onUpdate,
  insights,
}: {
  resume: Resume;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Resume>) => Promise<void>;
  insights?: GenerateInsights;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedResume, setEditedResume] = useState(resume);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'insights'>('preview');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(resume.id, editedResume);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <DocumentIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{resume.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {resume.targetJobTitle && `Targeting: ${resume.targetJobTitle}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {insights && (
              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden mr-4">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 text-sm ${activeTab === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`px-3 py-1.5 text-sm ${activeTab === 'insights' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  AI Insights
                </button>
              </div>
            )}
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditedResume(resume);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'insights' && insights ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* ATS Score */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  ATS Compatibility Score
                </h3>
                <div className="flex items-center gap-4">
                  <div
                    className={`text-5xl font-bold ${
                      insights.atsScore >= 70
                        ? 'text-green-600'
                        : insights.atsScore >= 50
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {insights.atsScore}%
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          insights.atsScore >= 70
                            ? 'bg-green-600'
                            : insights.atsScore >= 50
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                        }`}
                        style={{ width: `${insights.atsScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Matched Keywords */}
              {insights.matchedKeywords.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Matched Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {insights.matchedKeywords.map((keyword, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Keywords */}
              {insights.missingKeywords.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Missing Keywords
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Consider adding these skills/keywords to improve your match:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {insights.missingKeywords.map((keyword, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {insights.suggestions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Improvement Suggestions
                  </h3>
                  <ul className="space-y-2">
                    {insights.suggestions.map((suggestion, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-gray-600 dark:text-gray-400"
                      >
                        <span className="text-blue-500 mt-1">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Resume Preview */
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 shadow-lg rounded-lg p-8">
              {/* Header */}
              <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedResume.fullName || ''}
                      onChange={(e) =>
                        setEditedResume({ ...editedResume, fullName: e.target.value })
                      }
                      className="text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 outline-none"
                      placeholder="Your Name"
                    />
                  ) : (
                    resume.fullName || 'Your Name'
                  )}
                </h1>
                <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  {resume.email && <span>{resume.email}</span>}
                  {resume.phone && <span>• {resume.phone}</span>}
                  {resume.location && <span>• {resume.location}</span>}
                </div>
                <div className="flex flex-wrap justify-center gap-3 text-sm text-blue-600 dark:text-blue-400 mt-2">
                  {resume.linkedInUrl && (
                    <a href={resume.linkedInUrl} target="_blank" rel="noopener noreferrer">
                      LinkedIn
                    </a>
                  )}
                  {resume.githubUrl && (
                    <a href={resume.githubUrl} target="_blank" rel="noopener noreferrer">
                      GitHub
                    </a>
                  )}
                  {resume.portfolioUrl && (
                    <a href={resume.portfolioUrl} target="_blank" rel="noopener noreferrer">
                      Portfolio
                    </a>
                  )}
                </div>
              </div>

              {/* Summary */}
              {resume.summary && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">
                    Professional Summary
                  </h2>
                  {isEditing ? (
                    <textarea
                      value={editedResume.summary || ''}
                      onChange={(e) =>
                        setEditedResume({ ...editedResume, summary: e.target.value })
                      }
                      rows={4}
                      className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded p-2 text-gray-700 dark:text-gray-300"
                    />
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300">{resume.summary}</p>
                  )}
                </div>
              )}

              {/* Experience */}
              {resume.experience && resume.experience.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">
                    Experience
                  </h2>
                  <div className="space-y-4">
                    {(resume.experience as WorkExperience[]).map((exp, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {exp.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                              {exp.company}
                              {exp.location && ` - ${exp.location}`}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                          </span>
                        </div>
                        {exp.bullets && exp.bullets.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {exp.bullets.map((bullet, j) => (
                              <li
                                key={j}
                                className="text-gray-700 dark:text-gray-300 text-sm pl-4 relative before:content-['•'] before:absolute before:left-0"
                              >
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {resume.education && resume.education.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">
                    Education
                  </h2>
                  <div className="space-y-3">
                    {(resume.education as Education[]).map((edu, i) => (
                      <div key={i} className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {edu.institution}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {edu.degree}
                            {edu.major && ` in ${edu.major}`}
                            {edu.gpa && ` - GPA: ${edu.gpa}`}
                          </p>
                        </div>
                        {edu.endDate && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {edu.endDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {resume.skills && Object.keys(resume.skills).length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">
                    Skills
                  </h2>
                  <div className="space-y-2">
                    {Object.entries(resume.skills as Record<string, string[]>).map(
                      ([category, skills]) => (
                        <div key={category}>
                          <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {category}:{' '}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {skills.join(', ')}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {resume.certifications && resume.certifications.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">
                    Certifications
                  </h2>
                  <div className="space-y-2">
                    {(resume.certifications as Certification[]).map((cert, i) => (
                      <div key={i} className="flex justify-between items-start">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {cert.name}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400"> - {cert.issuer}</span>
                        </div>
                        {cert.date && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {cert.date}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for preview */}
              {!resume.summary && (!resume.experience || resume.experience.length === 0) && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <DocumentIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Add your experience and skills to see your resume preview.</p>
                  <p className="text-sm mt-2">Click "Edit" to start building your resume.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function ResumePage() {
  const { data: session, status } = useSession();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [generatedInsights, setGeneratedInsights] = useState<GenerateInsights | null>(null);

  const fetchResumes = useCallback(async () => {
    try {
      const response = await fetch('/api/career/resumes');
      if (response.ok) {
        const data = await response.json();
        setResumes(data.resumes || []);
      }
    } catch (error) {
      console.error('Error fetching resumes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchResumes();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, fetchResumes]);

  const handleCreateResume = async () => {
    try {
      const response = await fetch('/api/career/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Resume' }),
      });
      if (response.ok) {
        const data = await response.json();
        setResumes((prev) => [data.resume, ...prev]);
        // Fetch the full resume data and open editor
        const fullResponse = await fetch(`/api/career/resumes/${data.resume.id}`);
        if (fullResponse.ok) {
          const fullData = await fullResponse.json();
          setSelectedResume(fullData.resume);
        }
      }
    } catch (error) {
      console.error('Error creating resume:', error);
    }
  };

  const handleGenerateResume = async (data: {
    jobTitle: string;
    jobDescription: string;
    company?: string;
  }) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/career/resumes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        const result = await response.json();
        setResumes((prev) => [result.resume, ...prev]);
        setSelectedResume(result.resume);
        setGeneratedInsights(result.insights);
        setShowGenerateModal(false);
      }
    } catch (error) {
      console.error('Error generating resume:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteResume = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    try {
      const response = await fetch(`/api/career/resumes/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setResumes((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error('Error deleting resume:', error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/career/resumes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (response.ok) {
        setResumes((prev) =>
          prev.map((r) => ({
            ...r,
            isDefault: r.id === id,
          }))
        );
      }
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const handleSelectResume = async (resume: Resume) => {
    try {
      const response = await fetch(`/api/career/resumes/${resume.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedResume(data.resume);
        setGeneratedInsights(null);
      }
    } catch (error) {
      console.error('Error fetching resume:', error);
    }
  };

  const handleUpdateResume = async (id: string, data: Partial<Resume>) => {
    try {
      const response = await fetch(`/api/career/resumes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        const result = await response.json();
        setResumes((prev) => prev.map((r) => (r.id === id ? { ...r, ...result.resume } : r)));
        setSelectedResume(result.resume);
      }
    } catch (error) {
      console.error('Error updating resume:', error);
    }
  };

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Resume Builder
        </h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Resume Builder
        </h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="ml-3 text-gray-500 dark:text-gray-400">Loading your resumes...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Resume Builder
        </h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please sign in to access the Resume Builder
          </p>
          <a href="/auth/login" className="text-blue-600 hover:underline">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  const handleJoinWaitlist = async () => {
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'resume_builder' }),
      });
      if (response.ok) {
        alert("Thanks for your interest! We'll notify you when Resume Builder launches.");
      } else {
        alert('Failed to join waitlist. Please try again.');
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      alert('Failed to join waitlist. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Resume Builder
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create ATS-optimized resumes tailored to specific job opportunities
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <SparklesIcon className="w-5 h-5" />
            AI Generate
          </button>
          <button
            onClick={handleCreateResume}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            New Resume
          </button>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Coming Soon</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Our AI-powered Resume Builder is currently in development. Create professional,
              ATS-optimized resumes tailored to any job opportunity with intelligent keyword
              matching and formatting.
            </p>
            <button
              onClick={handleJoinWaitlist}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </div>

      {resumes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <DocumentIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No resumes yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Create professional resumes tailored to your target roles. Use AI to generate optimized
            content based on job descriptions.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <SparklesIcon className="w-5 h-5" />
              Generate with AI
            </button>
            <button
              onClick={handleCreateResume}
              className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Create Blank Resume
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              onDelete={handleDeleteResume}
              onSetDefault={handleSetDefault}
              onSelect={handleSelectResume}
            />
          ))}
        </div>
      )}

      {/* Generate Modal */}
      <GenerateModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGenerateResume}
        isGenerating={isGenerating}
      />

      {/* Resume Editor/Preview */}
      {selectedResume && (
        <ResumeEditor
          resume={selectedResume}
          onClose={() => {
            setSelectedResume(null);
            setGeneratedInsights(null);
          }}
          onUpdate={handleUpdateResume}
          insights={generatedInsights || undefined}
        />
      )}
    </div>
  );
}
