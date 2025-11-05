'use client';

import { useState, useEffect } from 'react';
import { useJobSearch } from '@/hooks/useCareer';
import { JobSearchParams, JobListing } from '@/types/career';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/forms/Input';
import { Select } from '@/components/ui/forms/Select';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';

export const JobMatches: React.FC = () => {
  const { jobs, isLoading, error, totalResults, currentPage, searchForJobs } = useJobSearch();
  const [searchParams, setSearchParams] = useState<JobSearchParams>({
    keywords: '',
    location: '',
    jobType: 'any',
    page: 1,
    limit: 10,
  });

  // Used to track form input before submission
  const [formInputs, setFormInputs] = useState({
    keywords: '',
    location: '',
    jobType: 'any',
  });

  useEffect(() => {
    // Initial job search on component mount
    searchForJobs(searchParams);
  }, [searchForJobs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormInputs(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({
      ...searchParams,
      ...formInputs,
      page: 1 // Reset to first page on new search
    });
    searchForJobs({
      ...searchParams,
      ...formInputs,
      page: 1
    });
  };

  const handlePageChange = (page: number) => {
    const newParams = { ...searchParams, page };
    setSearchParams(newParams);
    searchForJobs(newParams);
  };

  const applyToJob = (job: JobListing) => {
    // This would typically open a modal or navigate to an application form
    console.log('Applying to job:', job);
    // For demo purposes, we can log the job
    alert(`Applied to ${job.title} at ${job.company}!`);
  };

  const saveJob = (job: JobListing) => {
    // This would typically save the job to the user's saved jobs list
    console.log('Saving job:', job);
    // For demo purposes, we can log the job
    alert(`Saved ${job.title} at ${job.company}!`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Job Matches</h2>
      
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              name="keywords"
              value={formInputs.keywords}
              onChange={handleInputChange}
              placeholder="Job title, keywords, or company"
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <Input
              name="location"
              value={formInputs.location}
              onChange={handleInputChange}
              placeholder="Location"
              className="w-full"
            />
          </div>
          <div className="w-full md:w-40">
            <Select
              name="jobType"
              value={formInputs.jobType}
              onChange={handleInputChange}
              className="w-full"
            >
              <option value="any">Any Type</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="remote">Remote</option>
              <option value="internship">Internship</option>
            </Select>
          </div>
          <div>
            <Button type="submit" className="w-full md:w-auto">
              Search
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
      ) : (
        <>
          <div className="text-sm text-gray-500">
            {totalResults} jobs found. Showing page {currentPage}.
          </div>

          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{job.title}</h3>
                    <p className="text-lg">{job.company}</p>
                    <p className="text-gray-600">{job.location}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {job.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3">{job.description.substring(0, 150)}...</p>
                    
                    {job.matchPercentage && (
                      <div className="mt-2">
                        <span className="text-green-600 font-medium">
                          {job.matchPercentage}% match
                        </span> with your profile
                      </div>
                    )}
                    
                    <div className="mt-2 text-gray-500 text-sm">
                      Posted {job.posted} • {job.applicants} applicants
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-0 flex md:flex-col gap-2 justify-end">
                    <Button 
                      onClick={() => applyToJob(job)}
                      className="flex-1"
                    >
                      Apply
                    </Button>
                    <Button 
                      onClick={() => saveJob(job)}
                      variant="outline"
                      className="flex-1"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalResults > 0 && (
            <div className="flex justify-center mt-6">
              <div className="flex gap-2">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="outline"
                >
                  Previous
                </Button>
                
                {Array.from({ length: Math.min(5, Math.ceil(totalResults / searchParams.limit)) }, (_, i) => (
                  <Button
                    key={i}
                    onClick={() => handlePageChange(i + 1)}
                    variant={currentPage === i + 1 ? "default" : "outline"}
                  >
                    {i + 1}
                  </Button>
                ))}
                
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalResults / searchParams.limit)}
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JobMatches;