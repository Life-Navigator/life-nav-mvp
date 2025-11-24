import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST - Generate AI-optimized resume content
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      jobTitle,
      jobDescription,
      company,
      resumeId, // Optional - update existing resume
    } = body;

    if (!jobTitle && !jobDescription) {
      return NextResponse.json(
        { error: 'Job title or description required' },
        { status: 400 }
      );
    }

    // Gather user data for resume generation
    const [user, careerProfile, educationRecords, educationCourses] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.careerProfile.findFirst({
        where: { userId },
      }),
      prisma.educationRecord.findMany({
        where: { userId },
        orderBy: { endDate: 'desc' },
      }),
      prisma.educationCourse.findMany({
        where: { userId, certificateEarned: true },
        orderBy: { certificateDate: 'desc' },
        take: 10,
      }),
    ]);

    // Extract keywords from job description
    const keywords = extractKeywords(jobDescription || '');

    // Build skills from career profile and courses
    const technicalSkills = careerProfile?.skills || [];
    const certifications = careerProfile?.certifications || [];
    const courseSkills = educationCourses.flatMap(c => c.skills || []);
    const allSkills = [...new Set([...technicalSkills, ...courseSkills])];

    // Build education array
    const education = educationRecords.map(record => ({
      institution: record.institution,
      degree: record.degree,
      major: record.major,
      minor: record.minor,
      gpa: record.gpa,
      startDate: record.startDate?.toISOString().split('T')[0],
      endDate: record.endDate?.toISOString().split('T')[0],
      status: record.status,
      achievements: record.achievements,
    }));

    // Build certifications array
    const certificationsList = [
      ...certifications.map(cert => ({
        name: cert,
        issuer: 'Unknown',
        date: null,
      })),
      ...educationCourses
        .filter(c => c.certificateEarned)
        .map(c => ({
          name: c.title,
          issuer: c.provider,
          date: c.certificateDate?.toISOString().split('T')[0],
          url: c.certificateUrl,
        })),
    ];

    // Generate optimized summary using job context
    const summary = generateOptimizedSummary({
      currentTitle: careerProfile?.title,
      yearsExperience: careerProfile?.yearsExperience,
      skills: allSkills,
      targetTitle: jobTitle,
      company,
      keywords,
    });

    // Categorize and prioritize skills based on job description
    const categorizedSkills = categorizeSkills(allSkills, keywords);

    // Calculate ATS score
    const atsScore = calculateATSScore({
      skills: allSkills,
      keywords,
      hasSummary: !!summary,
      hasEducation: education.length > 0,
      hasCertifications: certificationsList.length > 0,
    });

    // Build resume data
    const resumeData = {
      name: `${jobTitle} Resume${company ? ` - ${company}` : ''}`,
      template: 'ats-friendly',
      fullName: user?.name,
      email: user?.email,
      linkedInUrl: careerProfile?.linkedInUrl,
      githubUrl: careerProfile?.githubUrl,
      portfolioUrl: careerProfile?.portfolioUrl,
      websiteUrl: careerProfile?.websiteUrl,
      summary,
      experience: [], // User will need to add their experience
      education,
      skills: categorizedSkills,
      certifications: certificationsList,
      projects: [],
      awards: [],
      publications: [],
      languages: careerProfile?.languages || [],
      targetJobTitle: jobTitle,
      targetJobDescription: jobDescription,
      targetCompany: company,
      keywords,
      aiGenerated: true,
      aiModel: 'life-navigator-v1',
      aiPrompt: `Generate resume for ${jobTitle} at ${company || 'target company'}`,
      atsScore,
      lastAnalyzedAt: new Date(),
      status: 'draft',
    };

    // Create or update resume
    let resume;
    if (resumeId) {
      // Update existing resume
      const existingResume = await prisma.resume.findFirst({
        where: { id: resumeId, userId },
      });

      if (!existingResume) {
        return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      }

      resume = await prisma.resume.update({
        where: { id: resumeId },
        data: {
          ...resumeData,
          version: existingResume.version + 1,
        },
      });
    } else {
      // Create new resume
      resume = await prisma.resume.create({
        data: {
          userId,
          ...resumeData,
        },
      });
    }

    return NextResponse.json({
      resume,
      insights: {
        atsScore,
        matchedKeywords: keywords.filter(k =>
          allSkills.some(s => s.toLowerCase().includes(k.toLowerCase()))
        ),
        missingKeywords: keywords.filter(k =>
          !allSkills.some(s => s.toLowerCase().includes(k.toLowerCase()))
        ),
        suggestions: generateSuggestions(atsScore, keywords, allSkills),
      },
    });
  } catch (error) {
    console.error('Error generating resume:', error);
    return NextResponse.json(
      { error: 'Failed to generate resume' },
      { status: 500 }
    );
  }
}

// Helper functions
function extractKeywords(jobDescription: string): string[] {
  // Common tech keywords and skill patterns
  const techPatterns = /\b(javascript|typescript|python|java|react|angular|vue|node|express|django|flask|spring|aws|azure|gcp|docker|kubernetes|sql|nosql|mongodb|postgresql|redis|git|agile|scrum|ci\/cd|rest|graphql|api|microservices|machine learning|ai|data science|devops|cloud|frontend|backend|fullstack|mobile|ios|android|swift|kotlin|flutter|react native)\b/gi;

  const softSkillPatterns = /\b(leadership|communication|problem.solving|teamwork|collaboration|analytical|strategic|management|presentation|negotiation|critical thinking|creativity|adaptability|time management)\b/gi;

  const techMatches = jobDescription.match(techPatterns) || [];
  const softMatches = jobDescription.match(softSkillPatterns) || [];

  // Deduplicate and normalize
  const allKeywords = [...new Set([...techMatches, ...softMatches].map(k => k.toLowerCase()))];

  return allKeywords;
}

function generateOptimizedSummary(data: {
  currentTitle?: string | null;
  yearsExperience?: number | null;
  skills: string[];
  targetTitle: string;
  company?: string;
  keywords: string[];
}): string {
  const { currentTitle, yearsExperience, skills, targetTitle, company, keywords } = data;

  const experienceText = yearsExperience
    ? `${yearsExperience}+ years of experience`
    : 'Experienced professional';

  const relevantSkills = skills
    .filter(s => keywords.some(k => s.toLowerCase().includes(k.toLowerCase())))
    .slice(0, 5);

  const skillsText = relevantSkills.length > 0
    ? `with expertise in ${relevantSkills.join(', ')}`
    : '';

  return `Results-driven ${currentTitle || 'professional'} with ${experienceText} ${skillsText}. Seeking to leverage proven skills and accomplishments to contribute to ${company || 'a dynamic organization'} as a ${targetTitle}. Committed to delivering high-quality solutions and driving business growth through innovation and collaboration.`;
}

function categorizeSkills(skills: string[], keywords: string[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    technical: [],
    frameworks: [],
    tools: [],
    soft: [],
    other: [],
  };

  const technicalPatterns = /^(javascript|typescript|python|java|c\+\+|c#|go|rust|ruby|php|sql|html|css|swift|kotlin)$/i;
  const frameworkPatterns = /^(react|angular|vue|node|express|django|flask|spring|nextjs|gatsby|nuxt)$/i;
  const toolPatterns = /^(git|docker|kubernetes|aws|azure|gcp|jenkins|jira|figma|postman)$/i;
  const softPatterns = /^(leadership|communication|teamwork|problem.solving|collaboration|management)$/i;

  // Prioritize skills that match job keywords
  const prioritizedSkills = skills.sort((a, b) => {
    const aMatch = keywords.some(k => a.toLowerCase().includes(k.toLowerCase()));
    const bMatch = keywords.some(k => b.toLowerCase().includes(k.toLowerCase()));
    return bMatch ? 1 : aMatch ? -1 : 0;
  });

  prioritizedSkills.forEach(skill => {
    if (technicalPatterns.test(skill)) {
      categories.technical.push(skill);
    } else if (frameworkPatterns.test(skill)) {
      categories.frameworks.push(skill);
    } else if (toolPatterns.test(skill)) {
      categories.tools.push(skill);
    } else if (softPatterns.test(skill)) {
      categories.soft.push(skill);
    } else {
      categories.other.push(skill);
    }
  });

  // Remove empty categories
  return Object.fromEntries(
    Object.entries(categories).filter(([_, v]) => v.length > 0)
  );
}

function calculateATSScore(data: {
  skills: string[];
  keywords: string[];
  hasSummary: boolean;
  hasEducation: boolean;
  hasCertifications: boolean;
}): number {
  let score = 0;

  // Keyword match (40 points max)
  const matchedKeywords = data.keywords.filter(k =>
    data.skills.some(s => s.toLowerCase().includes(k.toLowerCase()))
  );
  score += Math.min(40, (matchedKeywords.length / Math.max(1, data.keywords.length)) * 40);

  // Has professional summary (15 points)
  if (data.hasSummary) score += 15;

  // Has education (15 points)
  if (data.hasEducation) score += 15;

  // Has certifications (10 points)
  if (data.hasCertifications) score += 10;

  // Skills listed (20 points max based on count)
  score += Math.min(20, data.skills.length * 2);

  return Math.round(Math.min(100, score));
}

function generateSuggestions(atsScore: number, keywords: string[], skills: string[]): string[] {
  const suggestions: string[] = [];

  if (atsScore < 50) {
    suggestions.push('Your resume needs more optimization. Consider adding more relevant skills from the job description.');
  }

  const missingKeywords = keywords.filter(k =>
    !skills.some(s => s.toLowerCase().includes(k.toLowerCase()))
  );

  if (missingKeywords.length > 0) {
    suggestions.push(`Consider acquiring or highlighting these skills: ${missingKeywords.slice(0, 5).join(', ')}`);
  }

  if (skills.length < 10) {
    suggestions.push('Add more skills to improve your ATS score.');
  }

  suggestions.push('Add quantifiable achievements to your experience section (e.g., "Increased sales by 25%")');
  suggestions.push('Use action verbs at the start of each bullet point (e.g., Led, Developed, Implemented)');

  return suggestions;
}
