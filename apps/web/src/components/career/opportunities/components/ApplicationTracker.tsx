'use client';

import { useState } from 'react';
import { useJobApplications } from '@/hooks/useCareer';
import { JobApplication, JobApplicationCreate, ApplicationStatus } from '@/types/career';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/forms/Input';
import { Select } from '@/components/ui/forms/Select';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import { IconButton } from '@/components/ui/buttons/IconButton';

export const ApplicationTracker: React.FC = () => {
  const { 
    applications, 
    isLoading, 
    error, 
    addApplication, 
    updateApplication, 
    removeApplication 
  } = useJobApplications();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newApplication, setNewApplication] = useState<JobApplicationCreate>({
    companyName: '',
    jobTitle: '',
    jobDescription: '',
    applicationDate: new Date().toISOString().split('T')[0],
    status: 'applied',
    contactName: '',
    contactEmail: '',
    notes: '',
  });

  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    isEditing: boolean = false
  ) => {
    const { name, value } = e.target;
    
    if (isEditing && editingApplication) {
      setEditingApplication({
        ...editingApplication,
        [name]: value,
      });
    } else {
      setNewApplication({
        ...newApplication,
        [name]: value,
      });
    }
  };

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addApplication(newApplication);
    if (result) {
      setIsAddingNew(false);
      setNewApplication({
        companyName: '',
        jobTitle: '',
        jobDescription: '',
        applicationDate: new Date().toISOString().split('T')[0],
        status: 'applied',
        contactName: '',
        contactEmail: '',
        notes: '',
      });
    }
  };

  const handleUpdateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingApplication) {
      const { id, ...updates } = editingApplication;
      await updateApplication(id, updates);
      setEditingApplication(null);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (confirm('Are you sure you want to delete this application?')) {
      await removeApplication(id);
    }
  };

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case 'applied':
        return 'bg-blue-100 text-blue-800';
      case 'interview':
        return 'bg-purple-100 text-purple-800';
      case 'offered':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'accepted':
        return 'bg-emerald-100 text-emerald-800';
      case 'declined':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: ApplicationStatus) => {
    switch (status) {
      case 'applied':
        return 'Applied';
      case 'interview':
        return 'Interview';
      case 'offered':
        return 'Offered';
      case 'rejected':
        return 'Rejected';
      case 'accepted':
        return 'Accepted';
      case 'declined':
        return 'Declined';
      default:
        return status;
    }
  };

  // Group applications by status for kanban view
  const groupedApplications = applications.reduce((acc, app) => {
    if (!acc[app.status]) {
      acc[app.status] = [];
    }
    acc[app.status].push(app);
    return acc;
  }, {} as Record<ApplicationStatus, JobApplication[]>);

  const statuses: ApplicationStatus[] = ['applied', 'interview', 'offered', 'accepted', 'rejected', 'declined'];

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center text-red-500">
        {error}. Please try again.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Application Tracker</h2>
        <Button onClick={() => setIsAddingNew(!isAddingNew)}>
          {isAddingNew ? 'Cancel' : '+ Add Application'}
        </Button>
      </div>

      {isAddingNew && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Add New Application</h3>
          <form onSubmit={handleAddApplication} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company</label>
              <Input
                name="companyName"
                value={newApplication.companyName}
                onChange={handleInputChange}
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <Input
                name="jobTitle"
                value={newApplication.jobTitle}
                onChange={handleInputChange}
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Application Date</label>
              <Input
                type="date"
                name="applicationDate"
                value={newApplication.applicationDate}
                onChange={handleInputChange}
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select
                name="status"
                value={newApplication.status}
                onChange={handleInputChange}
                className="w-full"
              >
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offered">Offered</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="declined">Declined</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Contact Name</label>
              <Input
                name="contactName"
                value={newApplication.contactName}
                onChange={handleInputChange}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Contact Email</label>
              <Input
                type="email"
                name="contactEmail"
                value={newApplication.contactEmail}
                onChange={handleInputChange}
                className="w-full"
              />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium mb-1">Job Description</label>
              <textarea
                name="jobDescription"
                value={newApplication.jobDescription}
                onChange={handleInputChange}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                name="notes"
                value={newApplication.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-1 md:col-span-2 flex justify-end">
              <Button type="submit">Save Application</Button>
            </div>
          </form>
        </Card>
      )}

      {editingApplication && (
        <Card className="p-4 mt-4">
          <h3 className="text-lg font-semibold mb-4">Edit Application</h3>
          <form onSubmit={handleUpdateApplication} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company</label>
              <Input
                name="companyName"
                value={editingApplication.companyName}
                onChange={(e) => handleInputChange(e, true)}
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <Input
                name="jobTitle"
                value={editingApplication.jobTitle}
                onChange={(e) => handleInputChange(e, true)}
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Application Date</label>
              <Input
                type="date"
                name="applicationDate"
                value={editingApplication.applicationDate.split('T')[0]}
                onChange={(e) => handleInputChange(e, true)}
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select
                name="status"
                value={editingApplication.status}
                onChange={(e) => handleInputChange(e, true)}
                className="w-full"
              >
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offered">Offered</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="declined">Declined</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Contact Name</label>
              <Input
                name="contactName"
                value={editingApplication.contactName}
                onChange={(e) => handleInputChange(e, true)}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Contact Email</label>
              <Input
                type="email"
                name="contactEmail"
                value={editingApplication.contactEmail}
                onChange={(e) => handleInputChange(e, true)}
                className="w-full"
              />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium mb-1">Job Description</label>
              <textarea
                name="jobDescription"
                value={editingApplication.jobDescription}
                onChange={(e) => handleInputChange(e, true)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                name="notes"
                value={editingApplication.notes}
                onChange={(e) => handleInputChange(e, true)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-1 md:col-span-2 flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingApplication(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Kanban Board View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {statuses.map((status) => (
          <div key={status} className="flex flex-col h-full">
            <div className={`${getStatusColor(status)} px-3 py-2 rounded-t-md`}>
              <h3 className="font-medium">{getStatusText(status)} ({groupedApplications[status]?.length || 0})</h3>
            </div>
            
            <div className="flex-1 bg-gray-50 p-2 rounded-b-md overflow-y-auto max-h-[500px]">
              {groupedApplications[status]?.length > 0 ? (
                <div className="space-y-2">
                  {groupedApplications[status].map((app) => (
                    <Card key={app.id} className="p-3 hover:shadow-md transition-shadow">
                      <div className="flex justify-between">
                        <h4 className="font-semibold">{app.jobTitle}</h4>
                        <div className="flex space-x-1">
                          <IconButton
                            icon="✏️"
                            onClick={() => setEditingApplication(app)}
                            aria-label="Edit"
                            className="text-sm"
                          />
                          <IconButton
                            icon="🗑️"
                            onClick={() => handleDeleteApplication(app.id)}
                            aria-label="Delete"
                            className="text-sm text-red-500"
                          />
                        </div>
                      </div>
                      <p className="text-sm">{app.companyName}</p>
                      <p className="text-xs text-gray-500">
                        Applied: {new Date(app.applicationDate).toLocaleDateString()}
                      </p>
                      {app.contactName && (
                        <p className="text-xs mt-1">
                          Contact: {app.contactName}
                        </p>
                      )}
                      {app.notes && (
                        <p className="text-xs mt-1 italic">
                          {app.notes.substring(0, 50)}
                          {app.notes.length > 50 ? '...' : ''}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                  No applications
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApplicationTracker;