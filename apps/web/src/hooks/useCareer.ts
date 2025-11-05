import { useState, useEffect, useCallback } from 'react';
import { 
  getJobApplications, 
  createJobApplication, 
  updateJobApplication, 
  deleteJobApplication,
  searchJobs,
  getInterviewPrep
} from '@/lib/api/career';
import { 
  JobApplication, 
  JobApplicationCreate, 
  JobApplicationUpdate,
  JobListing, 
  InterviewPrepResource,
  JobSearchParams
} from '@/types/career';

// Hook for managing job applications
export function useJobApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getJobApplications();
      setApplications(data);
    } catch (err) {
      setError('Failed to fetch job applications');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addApplication = useCallback(async (application: JobApplicationCreate) => {
    setIsLoading(true);
    setError(null);
    try {
      const newApplication = await createJobApplication(application);
      setApplications(prev => [...prev, newApplication]);
      return newApplication;
    } catch (err) {
      setError('Failed to create job application');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateApplication = useCallback(async (id: string, updates: JobApplicationUpdate) => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await updateJobApplication(id, updates);
      setApplications(prev => 
        prev.map(app => app.id === id ? updated : app)
      );
      return updated;
    } catch (err) {
      setError('Failed to update job application');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeApplication = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteJobApplication(id);
      setApplications(prev => prev.filter(app => app.id !== id));
      return true;
    } catch (err) {
      setError('Failed to delete job application');
      console.error(err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return {
    applications,
    isLoading,
    error,
    fetchApplications,
    addApplication,
    updateApplication,
    removeApplication
  };
}

// Hook for job search functionality
export function useJobSearch() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const searchForJobs = useCallback(async (params: JobSearchParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const { jobs, total, page } = await searchJobs(params);
      setJobs(jobs);
      setTotalResults(total);
      setCurrentPage(page);
      return { jobs, total, page };
    } catch (err) {
      setError('Failed to search for jobs');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    jobs,
    isLoading,
    error,
    totalResults,
    currentPage,
    searchForJobs
  };
}

// Hook for interview preparation resources
export function useInterviewPrep() {
  const [resources, setResources] = useState<InterviewPrepResource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInterviewPrep = useCallback(async (jobTitle: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getInterviewPrep(jobTitle);
      setResources(data);
      return data;
    } catch (err) {
      setError('Failed to fetch interview preparation resources');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    resources,
    isLoading,
    error,
    fetchInterviewPrep
  };
}