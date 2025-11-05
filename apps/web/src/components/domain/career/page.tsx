// src/components/domain/career/page.tsx
'use client';

import { FC, useState } from 'react';
import Link from 'next/link';
import { 
  BriefcaseIcon, BookmarkIcon, CalendarIcon, ClockIcon, 
  CheckCircleIcon, UserGroupIcon, StarIcon
} from '@heroicons/react/24/outline';

interface Application {
  id: string;
  company: string;
  position: string;
  date: string;
  status: 'applied' | 'interview' | 'offer' | 'rejected';
}

interface Interview {
  id: string;
  company: string;
  position: string;
  date: string;
  time: string;
  type: 'phone' | 'video' | 'in-person';
  followUpNeeded: boolean;
  notes?: string;
}

interface TodoItem {
  id: string;
  task: string;
  dueDate: string;
  completed: boolean;
  category: 'application' | 'interview' | 'networking' | 'skill';
}

interface Contact {
  id: string;
  name: string;
  position: string;
  company: string;
  email: string;
  phone?: string;
  lastContact?: string;
}

interface Accomplishment {
  id: string;
  title: string;
  date: string;
  description: string;
  impact: string;
  tags: string[];
}

interface Performance {
  id: string;
  metric: string;
  value: number;
  target: number;
  period: string;
}

interface ExternalApp {
  id: string;
  name: string;
  icon: string;
  url: string;
  category: 'job-search' | 'networking' | 'payroll' | 'learning';
}

const CareerDashboard: FC = () => {
  // Example data
  const [applications, setApplications] = useState<Application[]>([
    { id: '1', company: 'Tech Innovators', position: 'Senior Developer', date: '2025-04-20', status: 'applied' },
    { id: '2', company: 'Global Systems', position: 'Software Architect', date: '2025-04-15', status: 'interview' },
    { id: '3', company: 'Future Labs', position: 'Lead Engineer', date: '2025-04-10', status: 'offer' },
    { id: '4', company: 'CodeCraft', position: 'DevOps Engineer', date: '2025-04-05', status: 'rejected' },
  ]);

  const [savedJobs, setSavedJobs] = useState<Application[]>([
    { id: '5', company: 'Data Dynamics', position: 'Full Stack Developer', date: '2025-04-22', status: 'applied' },
    { id: '6', company: 'Cloud Nexus', position: 'Cloud Architect', date: '2025-04-18', status: 'applied' },
  ]);

  const [interviews, setInterviews] = useState<Interview[]>([
    { 
      id: '1', 
      company: 'Global Systems', 
      position: 'Software Architect', 
      date: '2025-05-05', 
      time: '14:00', 
      type: 'video',
      followUpNeeded: false
    },
    { 
      id: '2', 
      company: 'Tech Solutions', 
      position: 'Product Manager', 
      date: '2025-05-10', 
      time: '10:30', 
      type: 'in-person',
      followUpNeeded: false
    },
  ]);

  const [followUps, setFollowUps] = useState<Interview[]>([
    { 
      id: '3', 
      company: 'InnovateTech', 
      position: 'Technical Lead', 
      date: '2025-04-25', 
      time: '11:00', 
      type: 'video',
      followUpNeeded: true,
      notes: 'Send thank you email and portfolio links'
    },
  ]);

  const [todoItems, setTodoItems] = useState<TodoItem[]>([
    { id: '1', task: 'Update resume with recent project', dueDate: '2025-05-03', completed: false, category: 'application' },
    { id: '2', task: 'Research Global Systems before interview', dueDate: '2025-05-04', completed: false, category: 'interview' },
    { id: '3', task: 'Connect with Sarah on LinkedIn', dueDate: '2025-05-02', completed: true, category: 'networking' },
    { id: '4', task: 'Complete AWS certification', dueDate: '2025-05-15', completed: false, category: 'skill' },
  ]);

  const [contacts, setContacts] = useState<Contact[]>([
    { id: '1', name: 'Alex Johnson', position: 'Engineering Director', company: 'Tech Innovators', email: 'alex@techinnovators.com', lastContact: '2025-04-15' },
    { id: '2', name: 'Sarah Miller', position: 'HR Manager', company: 'Global Systems', email: 'sarah@globalsystems.com', phone: '555-123-4567', lastContact: '2025-04-20' },
    { id: '3', name: 'Michael Wong', position: 'CTO', company: 'Future Labs', email: 'michael@futurelabs.com', lastContact: '2025-04-18' },
  ]);

  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([
    { 
      id: '1', 
      title: 'Project X Completion', 
      date: '2025-03-15', 
      description: 'Successfully led the deployment of Project X, a major company initiative', 
      impact: 'Increased system performance by 40%, resulting in $2M in savings',
      tags: ['leadership', 'project-management', 'deployment']
    },
    { 
      id: '2', 
      title: 'Team Innovation Award', 
      date: '2025-02-10', 
      description: 'Received recognition for innovative solution to data processing challenge', 
      impact: 'Solution adopted as company standard, improved workflow efficiency by 25%',
      tags: ['innovation', 'recognition', 'data-processing']
    },
  ]);

  const [performance, setPerformance] = useState<Performance[]>([
    { id: '1', metric: 'Projects Completed', value: 12, target: 15, period: 'Q1 2025' },
    { id: '2', metric: 'Team Productivity', value: 85, target: 80, period: 'Q1 2025' },
    { id: '3', metric: 'Client Satisfaction', value: 4.8, target: 4.5, period: 'Q1 2025' },
  ]);

  const [externalApps, setExternalApps] = useState<ExternalApp[]>([
    { id: '1', name: 'LinkedIn', icon: '/icons/linkedin.svg', url: 'https://linkedin.com', category: 'networking' },
    { id: '2', name: 'Indeed', icon: '/icons/indeed.svg', url: 'https://indeed.com', category: 'job-search' },
    { id: '3', name: 'Glassdoor', icon: '/icons/glassdoor.svg', url: 'https://glassdoor.com', category: 'job-search' },
    { id: '4', name: 'ADP', icon: '/icons/adp.svg', url: 'https://adp.com', category: 'payroll' },
    { id: '5', name: 'Paychex', icon: '/icons/paychex.svg', url: 'https://paychex.com', category: 'payroll' },
    { id: '6', name: 'Coursera', icon: '/icons/coursera.svg', url: 'https://coursera.org', category: 'learning' },
  ]);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Career Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your career progress, applications, and professional growth
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BriefcaseIcon className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Applications</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{applications.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link href="/career/applications" className="font-medium text-blue-700 hover:text-blue-900">
                View all
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookmarkIcon className="h-6 w-6 text-indigo-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Saved Jobs</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{savedJobs.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link href="/career/saved" className="font-medium text-blue-700 hover:text-blue-900">
                View all
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Upcoming Interviews</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{interviews.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link href="/career/interviews" className="font-medium text-blue-700 hover:text-blue-900">
                View all
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Follow-ups Needed</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{followUps.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link href="/career/follow-ups" className="font-medium text-blue-700 hover:text-blue-900">
                View all
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upcoming Interviews */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Upcoming Interviews</h3>
              <p className="mt-1 text-sm text-gray-500">Your scheduled interviews</p>
            </div>
            <Link href="/career/interviews" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              View all
            </Link>
          </div>
          <div className="border-t border-gray-200">
            <div className="divide-y divide-gray-200">
              {interviews.length > 0 ? (
                interviews.map((interview) => (
                  <div key={interview.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-blue-600 truncate">{interview.position}</p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${interview.type === 'video' ? 'bg-green-100 text-green-800' : 
                            interview.type === 'phone' ? 'bg-blue-100 text-blue-800' : 
                            'bg-purple-100 text-purple-800'}`}>
                          {interview.type}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          <BriefcaseIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          {interview.company}
                        </p>
                        <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                          <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          {interview.date} at {interview.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-5 sm:px-6 text-center">
                  <p className="text-sm text-gray-500">No upcoming interviews</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Todo Tasks */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">To-Do List</h3>
              <p className="mt-1 text-sm text-gray-500">Career-related tasks</p>
            </div>
            <Link href="/career/tasks" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              View all
            </Link>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {todoItems.filter(item => !item.completed).slice(0, 3).map((item) => (
                <li key={item.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <input
                        title="Mark task as complete"
                        placeholder="Toggle task completion status"
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={item.completed}
                        onChange={() => {
                          setTodoItems(prev => 
                            prev.map(todo => 
                              todo.id === item.id ? {...todo, completed: !todo.completed} : todo
                            )
                          );
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.task}</p>
                      <p className="text-sm text-gray-500">
                        Due: {item.dueDate}
                      </p>
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${item.category === 'application' ? 'bg-blue-100 text-blue-800' :
                          item.category === 'interview' ? 'bg-green-100 text-green-800' :
                          item.category === 'networking' ? 'bg-purple-100 text-purple-800' :
                          'bg-yellow-100 text-yellow-800'}`}>
                        {item.category}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contacts and Accomplishments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Contacts */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Key Contacts</h3>
              <p className="mt-1 text-sm text-gray-500">Professional network</p>
            </div>
            <Link href="/career/contacts" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              View all
            </Link>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {contacts.slice(0, 3).map((contact) => (
                <li key={contact.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                      <p className="text-xs text-gray-500">{contact.position} at {contact.company}</p>
                      <p className="text-xs text-gray-500">{contact.email}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        title="Send email"
                        type="button"
                        className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                      </button>
                      {contact.phone && (
                        <button
                          title="Call contact"
                          type="button"
                          className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add Contact
              </button>
            </div>
          </div>
        </div>

        {/* Accomplishments */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Accomplishments</h3>
              <p className="mt-1 text-sm text-gray-500">Track your professional achievements</p>
            </div>
            <Link href="/career/accomplishments" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              View all
            </Link>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {accomplishments.map((accomplishment) => (
                <li key={accomplishment.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">{accomplishment.title}</p>
                      <p className="text-sm text-gray-500 mt-1">{accomplishment.description}</p>
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-500">Impact: {accomplishment.impact}</span>
                      </div>
                      <div className="mt-2">
                        {accomplishment.tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mr-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add Accomplishment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance and Mentorship */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Performance Metrics */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Performance Tracking</h3>
              <p className="mt-1 text-sm text-gray-500">Monitor your professional metrics</p>
            </div>
            <Link href="/career/performance" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              View all
            </Link>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {performance.map((item) => (
                <li key={item.id} className="px-4 py-4 sm:px-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">{item.metric}</h4>
                      <p className="text-xs text-gray-500">{item.period}</p>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-700">{item.value}</span>
                          <span className="text-xs text-gray-500 ml-2">/ {item.target} target</span>
                        </div>
                        <span className={`text-xs font-medium ${
                          item.value >= item.target ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {Math.round((item.value / item.target) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            item.value >= item.target ? 'bg-green-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${Math.min((item.value / item.target) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add Metric
              </button>
            </div>
          </div>
        </div>

        {/* Mentorship */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Mentorship</h3>
            <p className="mt-1 text-sm text-gray-500">Connect with mentors and mentees</p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <UserGroupIcon className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Find a Mentor</h4>
                    <p className="text-xs text-gray-500">Connect with experienced professionals in your field</p>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Explore Mentors
                  </button>
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <StarIcon className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Become a Mentor</h4>
                    <p className="text-xs text-gray-500">Share your expertise with others in your industry</p>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Start Mentoring
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CareerDashboard;