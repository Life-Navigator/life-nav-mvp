'use client';

import React, { useState } from 'react';

export interface WalletCredential {
  id: string;
  title: string;
  provider: string;
  platform?: string | null;
  certificateUrl?: string | null;
  certificateDate?: string | null;
  skills: string[];
  status: string;
  completedAt?: string | null;
  isStandalone: boolean;
  source: string;
  certificateImagePath?: string | null;
}

interface WalletCredentialCardProps {
  credential: WalletCredential;
  onView?: () => void;
  onDelete?: (id: string) => void;
}

export default function WalletCredentialCard({
  credential,
  onView,
  onDelete,
}: WalletCredentialCardProps) {
  const [showBack, setShowBack] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getTypeGradient = (provider: string) => {
    const lower = provider.toLowerCase();
    if (lower.includes('degree')) return 'from-purple-600 to-indigo-800';
    if (lower.includes('diploma')) return 'from-blue-600 to-cyan-800';
    if (lower.includes('license')) return 'from-amber-600 to-orange-800';
    if (lower.includes('badge')) return 'from-pink-600 to-rose-800';
    return 'from-emerald-600 to-teal-800';
  };

  const hasImage = credential.certificateImagePath && !imageError;
  const imageUrl = credential.certificateImagePath
    ? `/api/storage/documents/${credential.certificateImagePath}`
    : null;

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const gradient = getTypeGradient(credential.provider);

  return (
    <div className="space-y-2">
      <div
        className="relative w-full aspect-[1.586/1] cursor-pointer perspective-1000"
        onClick={() => setShowBack(!showBack)}
      >
        <div
          className={`absolute inset-0 transition-all duration-500 transform-style-3d ${
            showBack ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front of Card */}
          <div className="absolute inset-0 rounded-xl shadow-2xl overflow-hidden backface-hidden">
            {hasImage ? (
              <>
                <img
                  src={imageUrl!}
                  alt={credential.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
                {/* Gradient overlay at bottom for text readability */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
                  <h3 className="text-lg font-bold text-white line-clamp-2">{credential.title}</h3>
                  <p className="text-sm text-white/80">{credential.provider}</p>
                </div>
              </>
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${gradient} p-6 text-white flex flex-col`}
              >
                {/* Card Header */}
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-3">
                    <h3 className="text-xl font-bold line-clamp-2">{credential.title}</h3>
                    <p className="text-sm opacity-90 mt-1">{credential.provider}</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold">{credential.provider.charAt(0)}</span>
                  </div>
                </div>

                {/* Date */}
                <div className="mt-auto">
                  <p className="text-xs opacity-75">Earned</p>
                  <p className="text-sm">{formatDate(credential.certificateDate)}</p>
                </div>

                {/* Skills preview */}
                {credential.skills && credential.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {credential.skills.slice(0, 3).map((skill, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-white/20 rounded text-xs">
                        {skill}
                      </span>
                    ))}
                    {credential.skills.length > 3 && (
                      <span className="px-2 py-0.5 text-xs opacity-75">
                        +{credential.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Flip indicator */}
            <div className="absolute bottom-3 right-3">
              <svg
                className="w-5 h-5 text-white opacity-75"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>

          {/* Back of Card */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-xl shadow-2xl p-5 text-white backface-hidden rotate-y-180 overflow-y-auto`}
          >
            <h4 className="text-lg font-bold mb-3">Credential Details</h4>

            <div className="space-y-2 text-sm">
              {/* Provider */}
              <div className="bg-white bg-opacity-10 rounded-lg p-3">
                <p className="text-xs opacity-75 mb-1">Issuing Organization</p>
                <p className="font-medium">{credential.provider}</p>
              </div>

              {/* Platform */}
              {credential.platform && (
                <div className="bg-white bg-opacity-10 rounded-lg p-3">
                  <p className="text-xs opacity-75 mb-1">Platform</p>
                  <p>{credential.platform}</p>
                </div>
              )}

              {/* Date */}
              <div className="bg-white bg-opacity-10 rounded-lg p-3">
                <p className="text-xs opacity-75 mb-1">Date Earned</p>
                <p>{formatDate(credential.certificateDate)}</p>
              </div>

              {/* Skills */}
              {credential.skills && credential.skills.length > 0 && (
                <div className="bg-white bg-opacity-10 rounded-lg p-3">
                  <p className="text-xs opacity-75 mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {credential.skills.map((skill, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-white/20 rounded text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Credential URL */}
              {credential.certificateUrl && (
                <div className="bg-white bg-opacity-10 rounded-lg p-3">
                  <p className="text-xs opacity-75 mb-1">Credential URL</p>
                  <a
                    href={credential.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline truncate block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {credential.certificateUrl}
                  </a>
                </div>
              )}
            </div>

            {/* Delete action */}
            {onDelete && (
              <div className="mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(credential.id);
                  }}
                  className="px-3 py-1.5 bg-red-500/30 hover:bg-red-500/50 rounded text-xs transition-colors"
                >
                  Delete
                </button>
              </div>
            )}

            {/* Flip indicator */}
            <div className="absolute bottom-3 right-3">
              <svg
                className="w-5 h-5 opacity-75"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-500 dark:text-gray-400">Click card to flip</p>
    </div>
  );
}
