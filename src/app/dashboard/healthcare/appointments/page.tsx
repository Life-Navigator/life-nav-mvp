'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  CalendarIcon, 
  ClockIcon, 
  PlusIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  XMarkIcon,
  CheckIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface Appointment {
  id: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

// Appointments will be fetched from API - empty for now

export default function AppointmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Appointment form state
  const [newAppointment, setNewAppointment] = useState({
    doctor: '',
    specialty: '',
    date: '',
    time: '',
    location: '',
    notes: ''
  });
  
  // Month calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        // TODO: Implement API endpoint for fetching appointments
        // const response = await fetch('/api/healthcare/appointments');
        // const data = await response.json();
        // setAppointments(data);

        // For now, set empty array - will be populated when users schedule appointments
        setAppointments([]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching appointments:', err);
        setError('Failed to load appointments. Please try again later.');
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchAppointments();
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  // Filter appointments
  const filteredAppointments = appointments
    .filter(apt => filter === 'all' || apt.status === filter)
    .filter(apt => 
      apt.doctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.notes.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAppointment(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real app, this would be an API call to create a new appointment
    const id = `apt${appointments.length + 1}`;
    const newAppointmentData: Appointment = {
      ...newAppointment,
      id,
      status: 'upcoming'
    };
    
    setAppointments([...appointments, newAppointmentData]);
    setShowNewAppointmentModal(false);
    setNewAppointment({
      doctor: '',
      specialty: '',
      date: '',
      time: '',
      location: '',
      notes: ''
    });
  };
  
  // Change appointment status
  const updateAppointmentStatus = (id: string, status: 'upcoming' | 'completed' | 'cancelled') => {
    setAppointments(appointments.map(apt => 
      apt.id === id ? { ...apt, status } : apt
    ));
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  // Move to previous month
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  // Move to next month
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  // Get days in current month view
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 6 = Saturday)
    const startDay = firstDay.getDay();
    
    // Calculate days from previous month to display
    const daysFromPrevMonth = startDay;
    const prevLastDay = new Date(year, month, 0).getDate();
    
    const days = [];
    
    // Add days from previous month
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevLastDay - i),
        isCurrentMonth: false,
        hasAppointment: false
      });
    }
    
    // Add days from current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      
      // Check if there are appointments on this day
      const hasAppointment = appointments.some(apt => {
        const aptDate = new Date(apt.date);
        return aptDate.getDate() === i && 
               aptDate.getMonth() === month && 
               aptDate.getFullYear() === year;
      });
      
      days.push({
        date,
        isCurrentMonth: true,
        hasAppointment
      });
    }
    
    // Calculate days needed from next month to complete grid
    const daysNeeded = 42 - days.length; // 6 rows * 7 days = 42
    
    // Add days from next month
    for (let i = 1; i <= daysNeeded; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        hasAppointment: false
      });
    }
    
    return days;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading appointments...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Medical Appointments</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage and track your healthcare appointments</p>
          </div>
          <div className="mt-4 lg:mt-0">
            <button 
              onClick={() => setShowNewAppointmentModal(true)}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Schedule Appointment
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            {/* Appointment List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2 sm:mb-0">Your Appointments</h2>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search appointments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              
              <div>
                {filteredAppointments.length === 0 ? (
                  <div className="p-8 text-center">
                    <CalendarIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">No appointments found</p>
                    <p className="text-gray-500 dark:text-gray-500 mt-1">
                      {filter !== 'all' 
                        ? `You have no ${filter} appointments` 
                        : "Schedule your first appointment by clicking the 'Schedule Appointment' button"}
                    </p>
                    {filter !== 'all' && (
                      <button 
                        className="mt-4 px-4 py-2 text-red-600 dark:text-red-400 border border-red-600 dark:border-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setFilter('all')}
                      >
                        View All Appointments
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredAppointments.map((appointment) => (
                      <li 
                        key={appointment.id} 
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        onClick={() => setViewAppointment(appointment)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center mr-3 ${
                                appointment.status === 'upcoming' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                appointment.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                <CalendarIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <h3 className="text-base font-medium text-gray-900 dark:text-white">
                                  {appointment.doctor}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {appointment.specialty}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center mb-1">
                              <ClockIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-1" />
                              <p className="text-sm text-gray-900 dark:text-white">
                                {appointment.time}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(appointment.date)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 ml-13 sm:ml-14">
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              appointment.status === 'upcoming' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                              appointment.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </span>
                            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                              {appointment.location}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          
          <div>
            {/* Calendar View */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Calendar</h2>
                  <div className="flex items-center">
                    <button
                      onClick={previousMonth}
                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <span className="px-2 text-gray-900 dark:text-white">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={nextMonth}
                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="py-1">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth().map((day, index) => (
                    <button
                      key={index}
                      className={`h-10 w-full rounded-full text-sm ${
                        day.isCurrentMonth
                          ? day.hasAppointment
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 font-medium'
                            : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                          : 'text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      {day.date.getDate()}
                    </button>
                  ))}
                </div>
                
                <div className="mt-4">
                  <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-100 dark:bg-red-900/30 mr-1"></span>
                    <span>Has appointment</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mt-6">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Appointment Stats</h2>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Upcoming</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {appointments.filter(apt => apt.status === 'upcoming').length}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {appointments.filter(apt => apt.status === 'completed').length}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cancelled</p>
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                      {appointments.filter(apt => apt.status === 'cancelled').length}
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Next Appointment</h3>
                  {appointments.filter(apt => apt.status === 'upcoming').length > 0 ? (
                    (() => {
                      const nextAppointment = appointments
                        .filter(apt => apt.status === 'upcoming')
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                      
                      return (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {nextAppointment.doctor}
                          </p>
                          <div className="flex items-center mt-1">
                            <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-1" />
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {formatDate(nextAppointment.date)} at {nextAppointment.time}
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No upcoming appointments
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <Link
            href="/dashboard/healthcare"
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
          >
            ← Back to Health Dashboard
          </Link>
          <Link
            href="/dashboard/healthcare/records"
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
          >
            Medical Records →
          </Link>
        </div>
      </div>
      
      {/* New Appointment Modal */}
      {showNewAppointmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schedule New Appointment</h3>
              <button 
                onClick={() => setShowNewAppointmentModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Doctor's Name*
                </label>
                <input 
                  type="text" 
                  name="doctor"
                  value={newAppointment.doctor}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Specialty
                </label>
                <input 
                  type="text" 
                  name="specialty"
                  value={newAppointment.specialty}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date*
                  </label>
                  <input 
                    type="date" 
                    name="date"
                    value={newAppointment.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time*
                  </label>
                  <input 
                    type="time" 
                    name="time"
                    value={newAppointment.time}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <input 
                  type="text" 
                  name="location"
                  value={newAppointment.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea 
                  name="notes"
                  value={newAppointment.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewAppointmentModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* View Appointment Modal */}
      {viewAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Appointment Details</h3>
              <button 
                onClick={() => setViewAppointment(null)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center mr-4 ${
                  viewAppointment.status === 'upcoming' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                  viewAppointment.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  <CalendarIcon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    {viewAppointment.doctor}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {viewAppointment.specialty}
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex items-start">
                  <CalendarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Date & Time</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(viewAppointment.date)} at {viewAppointment.time}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Location</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {viewAppointment.location}
                    </p>
                  </div>
                </div>
                
                {viewAppointment.notes && (
                  <div className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Notes</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {viewAppointment.notes}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Status</p>
                    <p className={`text-sm font-medium ${
                      viewAppointment.status === 'upcoming' ? 'text-blue-600 dark:text-blue-400' :
                      viewAppointment.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                      'text-gray-600 dark:text-gray-400'
                    }`}>
                      {viewAppointment.status.charAt(0).toUpperCase() + viewAppointment.status.slice(1)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-2">
                {viewAppointment.status === 'upcoming' && (
                  <>
                    <button
                      onClick={() => {
                        updateAppointmentStatus(viewAppointment.id, 'completed');
                        setViewAppointment({...viewAppointment, status: 'completed'});
                      }}
                      className="flex items-center px-3 py-1.5 text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900/40"
                    >
                      <CheckIcon className="h-4 w-4 mr-1.5" />
                      Mark Completed
                    </button>
                    
                    <button
                      onClick={() => {
                        updateAppointmentStatus(viewAppointment.id, 'cancelled');
                        setViewAppointment({...viewAppointment, status: 'cancelled'});
                      }}
                      className="flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <XMarkIcon className="h-4 w-4 mr-1.5" />
                      Cancel Appointment
                    </button>
                  </>
                )}
                
                <button className="flex items-center px-3 py-1.5 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/40">
                  <PencilIcon className="h-4 w-4 mr-1.5" />
                  Edit
                </button>
                
                <button className="flex items-center px-3 py-1.5 text-sm bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900/40">
                  <TrashIcon className="h-4 w-4 mr-1.5" />
                  Delete
                </button>
              </div>
              
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setViewAppointment(null)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}