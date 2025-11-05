'use client';

import { useState } from 'react';
import { useInterviewPrep } from '@/hooks/useCareer';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/forms/Input';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';

export const InterviewPrep: React.FC = () => {
  const { resources, isLoading, error, fetchInterviewPrep } = useInterviewPrep();
  const [jobTitle, setJobTitle] = useState('');
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchInterviewPrep(jobTitle);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Interview Preparation</h2>
      
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Enter job title (e.g., Software Engineer, Product Manager)"
              className="w-full"
              required
            />
          </div>
          <div>
            <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
              {isLoading ? 'Loading...' : 'Get Interview Tips'}
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <Card className="p-6 text-center text-red-500">
          {error}. Please try again.
        </Card>
      ) : resources ? (
        <div className="space-y-6">
          <Card className="p-6 bg-blue-50">
            <h3 className="text-xl font-semibold mb-2">Preparation Tips for {resources.jobTitle}</h3>
            <p>{resources.overview}</p>
            
            <div className="mt-4">
              <h4 className="font-medium mb-2">Key Skills to Highlight:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {resources.keySkills.map((skill, index) => (
                  <li key={index}>{skill}</li>
                ))}
              </ul>
            </div>
          </Card>

          <div>
            <h3 className="text-xl font-semibold mb-4">Common Interview Questions</h3>
            <div className="space-y-3">
              {resources.questions.map((question, index) => (
                <Card 
                  key={index} 
                  className="overflow-hidden transition-all duration-200"
                >
                  <div 
                    className="p-4 cursor-pointer flex justify-between items-center"
                    onClick={() => setActiveQuestion(activeQuestion === question.question ? null : question.question)}
                  >
                    <h4 className="font-medium">{question.question}</h4>
                    <span>{activeQuestion === question.question ? '−' : '+'}</span>
                  </div>
                  
                  {activeQuestion === question.question && (
                    <div className="p-4 pt-0 border-t">
                      <p className="mb-3">{question.answer}</p>
                      
                      {question.tips && (
                        <div className="mt-3 bg-yellow-50 p-3 rounded-md">
                          <p className="text-sm font-medium text-yellow-800">Pro Tip:</p>
                          <p className="text-sm text-yellow-700">{question.tips}</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {resources.resources.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Additional Resources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.resources.map((resource, index) => (
                  <Card key={index} className="p-4">
                    <h4 className="font-medium mb-1">{resource.title}</h4>
                    <p className="text-sm mb-2">{resource.description}</p>
                    <a 
                      href={resource.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      View Resource →
                    </a>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Card className="p-6 bg-green-50">
            <h3 className="text-xl font-semibold mb-2">Interview Checklist</h3>
            <div className="space-y-2">
              {resources.checklist.map((item, index) => (
                <div key={index} className="flex items-start">
                  <input 
                    type="checkbox" 
                    id={`checklist-${index}`} 
                    className="mt-1 mr-2"
                  />
                  <label htmlFor={`checklist-${index}`}>{item}</label>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p>Enter a job title above to get customized interview preparation resources.</p>
        </Card>
      )}
    </div>
  );
};

export default InterviewPrep;