'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Award, ExternalLink, Share2, Download } from 'lucide-react';
import { format } from 'date-fns';

interface CredentialCardProps {
  credential: {
    id: string;
    credential_type: string;
    title: string;
    institution: string;
    institution_logo?: string;
    field_of_study?: string;
    issue_date?: string;
    expiry_date?: string;
    is_verified: boolean;
    credential_url?: string;
    grade?: string;
    gpa?: number;
    honors?: string;
    certificate_image?: string;
  };
  onShare?: () => void;
  onDownload?: () => void;
}

export function CredentialCard({ credential, onShare, onDownload }: CredentialCardProps) {
  const isExpiring = credential.expiry_date &&
    new Date(credential.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const typeColors: Record<string, string> = {
    degree: 'bg-purple-100 text-purple-800 border-purple-200',
    diploma: 'bg-blue-100 text-blue-800 border-blue-200',
    certificate: 'bg-green-100 text-green-800 border-green-200',
    license: 'bg-orange-100 text-orange-800 border-orange-200',
    badge: 'bg-pink-100 text-pink-800 border-pink-200',
    'micro-credential': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {credential.institution_logo ? (
              <img
                src={credential.institution_logo}
                alt={credential.institution}
                className="w-12 h-12 rounded-lg object-contain bg-white p-1 border"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg line-clamp-2">{credential.title}</h3>
              <p className="text-sm text-muted-foreground">{credential.institution}</p>
            </div>
          </div>
          {credential.is_verified && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              ✓ Verified
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge className={typeColors[credential.credential_type] || 'bg-gray-100'}>
            {credential.credential_type.replace('-', ' ').toUpperCase()}
          </Badge>
          {credential.field_of_study && (
            <Badge variant="outline">{credential.field_of_study}</Badge>
          )}
          {credential.honors && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              {credential.honors}
            </Badge>
          )}
        </div>

        {/* Dates and Grade */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {credential.issue_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground text-xs">Issued</p>
                <p className="font-medium">{format(new Date(credential.issue_date), 'MMM yyyy')}</p>
              </div>
            </div>
          )}
          {credential.grade && (
            <div>
              <p className="text-muted-foreground text-xs">Grade</p>
              <p className="font-medium">
                {credential.grade}
                {credential.gpa && ` (${credential.gpa})`}
              </p>
            </div>
          )}
        </div>

        {/* Expiry Warning */}
        {isExpiring && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <Calendar className="w-4 h-4 text-orange-600" />
            <p className="text-sm text-orange-800">
              Expires on {format(new Date(credential.expiry_date!), 'MMM dd, yyyy')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {credential.credential_url && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={credential.credential_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Verify
              </a>
            </Button>
          )}
          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          )}
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
