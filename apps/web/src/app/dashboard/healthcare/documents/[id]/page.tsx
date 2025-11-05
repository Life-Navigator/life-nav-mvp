'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon, 
  ArrowDownTrayIcon, 
  ShareIcon, 
  TrashIcon,
  PencilIcon,
  LockClosedIcon,
  ClockIcon,
  DocumentIcon,
  TagIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

interface SecureDocument {
  id: string;
  filename: string;
  type: string;
  category: string;
  size: string;
  uploadDate: string;
  lastAccessed: string;
  tags: string[];
  encrypted: boolean;
  favorite: boolean;
  createdBy?: string;
  encryptionType?: string;
  previewUrl?: string;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [document, setDocument] = useState<SecureDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        
        // In a real app, this would be an API call
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Mock document data
        const mockDocument: SecureDocument = {
          id: params.id as string,
          filename: 'Health_Insurance_Policy.pdf',
          type: 'PDF',
          category: 'insurance',
          size: '1.2 MB',
          uploadDate: '2025-04-15',
          lastAccessed: '2025-05-08',
          tags: ['insurance', 'healthcare', 'policy'],
          encrypted: true,
          favorite: true,
          createdBy: 'Mobile App Scanner',
          encryptionType: 'AES-256',
          previewUrl: '/images/document-preview.png'
        };
        
        setDocument(mockDocument);
        setTags(mockDocument.tags);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Failed to load document. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchDocument();
  }, [params.id]);
  
  const handleDelete = () => {
    // In a real app, this would call the API to delete the document
    setShowDeleteModal(false);
    router.push('/dashboard/healthcare/documents');
  };
  
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };
  
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  const saveTagChanges = () => {
    if (document) {
      setDocument({
        ...document,
        tags
      });
      setEditingTags(false);
    }
  };
  
  const toggleFavorite = () => {
    if (document) {
      setDocument({
        ...document,
        favorite: !document.favorite
      });
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading document...</div>
      </div>
    );
  }
  
  if (error || !document) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-300">{error || 'Document not found'}</p>
          <Link 
            href="/dashboard/healthcare/documents"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Documents
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center mb-6">
          <Link 
            href="/dashboard/healthcare/documents"
            className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{document.filename}</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Document Preview</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={toggleFavorite}
                    className={`p-1.5 rounded-full ${
                      document.favorite 
                        ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' 
                        : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-5 w-5 ${document.favorite ? 'fill-yellow-500' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" 
                      />
                    </svg>
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  >
                    <ShareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {document.type === 'PDF' && (
                <div className="bg-gray-100 dark:bg-gray-700 p-8 flex items-center justify-center min-h-[500px]">
                  <div className="text-center">
                    <DocumentIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-2">PDF preview is not available</p>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                      Download to View
                    </button>
                  </div>
                </div>
              )}
              
              {document.type === 'IMAGE' && document.previewUrl && (
                <div className="flex items-center justify-center p-4">
                  <img 
                    src={document.previewUrl} 
                    alt={document.filename}
                    className="max-w-full max-h-[500px] object-contain"
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Document Details */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Document Details</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Filename</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{document.filename}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{document.category}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">File Type</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{document.type}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">File Size</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{document.size}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Upload Date</h3>
                  <div className="mt-1 flex items-center">
                    <ClockIcon className="h-4 w-4 text-gray-400 mr-1.5" />
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(document.uploadDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Accessed</h3>
                  <div className="mt-1 flex items-center">
                    <ClockIcon className="h-4 w-4 text-gray-400 mr-1.5" />
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(document.lastAccessed).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {document.createdBy && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Created By</h3>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{document.createdBy}</p>
                  </div>
                )}
                
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Tags</h3>
                    {!editingTags ? (
                      <button
                        onClick={() => setEditingTags(true)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={saveTagChanges}
                        className="text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                      >
                        Save
                      </button>
                    )}
                  </div>
                  
                  {!editingTags ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {document.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        >
                          <TagIcon className="h-3 w-3 mr-1" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addTag()}
                          placeholder="Add a tag..."
                          className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                        />
                        <button
                          onClick={addTag}
                          className="ml-2 px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Add
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="ml-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <span className="sr-only">Remove tag</span>
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Security</h2>
              </div>
              <div className="p-4">
                <div className="flex items-center text-green-600 dark:text-green-400 mb-4">
                  <LockClosedIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">End-to-End Encrypted</span>
                </div>
                
                {document.encryptionType && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Encryption Type</h3>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{document.encryptionType}</p>
                  </div>
                )}
                
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    This document is protected with strong encryption. Only you can access it.
                  </p>
                </div>
                
                <div className="mt-4 flex justify-between">
                  <button className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                    <Cog6ToothIcon className="h-4 w-4 mr-1.5" />
                    Security Settings
                  </button>
                  <button className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                    <PencilIcon className="h-4 w-4 mr-1.5" />
                    Rename
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Document</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to delete "{document.filename}"? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Share Document</h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Share "{document.filename}" securely with others. The link will expire after the selected time period.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recipient Email
                  </label>
                  <input 
                    type="email" 
                    placeholder="email@example.com" 
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Access Expires
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    <option value="1d">After 1 day</option>
                    <option value="7d">After 7 days</option>
                    <option value="30d">After 30 days</option>
                    <option value="never">Never</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Access Level
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    <option value="view">View only</option>
                    <option value="download">View and download</option>
                    <option value="edit">View, download, and edit</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-3 mt-4">
                <p className="text-xs text-yellow-800 dark:text-yellow-300">
                  <span className="font-medium">Security notice:</span> This document will be shared securely,
                  but remember that anyone with the link and permissions will be able to access it until expiration.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Share Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}