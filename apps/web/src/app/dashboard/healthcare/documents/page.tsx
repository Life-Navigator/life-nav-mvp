'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { LockClosedIcon, ShieldCheckIcon, DocumentIcon, FolderIcon, TagIcon, MagnifyingGlassIcon, FunnelIcon, ArrowUpTrayIcon, QrCodeIcon, TrashIcon, PencilIcon, ShareIcon } from '@heroicons/react/24/outline';

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
}

const categories = [
  { id: 'all', name: 'All Documents' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'medical', name: 'Medical' },
  { id: 'identification', name: 'Identification' },
  { id: 'financial', name: 'Financial' },
  { id: 'legal', name: 'Legal' },
];

export default function DocumentVaultPage() {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<SecureDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);

        // TODO: Implement API endpoint for fetching secure documents
        // const response = await fetch('/api/documents');
        // const data = await response.json();
        // setDocuments(data);

        // For now, set empty array - will be populated when users upload documents
        setDocuments([]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Failed to load document vault. Please try again later.');
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Filter documents based on category and search term
  const filteredDocuments = documents
    .filter(doc => selectedCategory === 'all' || doc.category === selectedCategory)
    .filter(doc => 
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

  const toggleFavorite = (id: string) => {
    setDocuments(prevDocs => 
      prevDocs.map(doc => 
        doc.id === id ? { ...doc, favorite: !doc.favorite } : doc
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading secure documents...</div>
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center">
            <ShieldCheckIcon className="h-8 w-8 text-red-600 dark:text-red-400 mr-2" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ultra Secure Document Vault</h1>
              <p className="text-gray-600 dark:text-gray-400">Store and manage your sensitive documents with end-to-end encryption</p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <button 
              onClick={() => setShowScanModal(true)}
              className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <QrCodeIcon className="h-5 w-5 mr-2" />
              Scan Document
            </button>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm transition-colors"
            >
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              Upload Document
            </button>
          </div>
        </div>
        
        {/* Security info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <LockClosedIcon className="h-6 w-6 text-blue-500 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">End-to-End Encrypted Storage</h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                All documents are encrypted before storage using AES-256 encryption. Only you can access your documents.
                Your data is protected with biometric verification for added security.
              </p>
            </div>
          </div>
        </div>
        
        {/* Categories and search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 p-4">
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0">
            <div className="flex flex-wrap gap-2 md:mr-4">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-red-100 text-red-800 dark:bg-red-500 dark:text-white font-medium shadow-sm'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search documents or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>
        
        {/* Documents list */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <DocumentIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">No documents found</p>
              <p className="text-gray-500 dark:text-gray-500 mt-1">
                {searchTerm 
                  ? "Try a different search term or category" 
                  : "Upload your first document to get started"}
              </p>
              {(searchTerm || selectedCategory !== 'all') && (
                <button 
                  className="mt-4 px-4 py-2 text-red-600 dark:text-red-400 border border-red-600 dark:border-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Document
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Size
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tags
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                            {doc.type === 'PDF' && (
                              <DocumentIcon className="h-6 w-6 text-red-500" />
                            )}
                            {doc.type === 'IMAGE' && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {doc.filename}
                              </div>
                              {doc.encrypted && (
                                <LockClosedIcon className="h-3.5 w-3.5 ml-2 text-green-500 dark:text-green-400" />
                              )}
                              <button
                                onClick={() => toggleFavorite(doc.id)}
                                className="ml-2 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400"
                              >
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  className={`h-4 w-4 ${doc.favorite ? 'text-yellow-500 fill-yellow-500' : ''}`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              </button>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {doc.type}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {doc.size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(doc.uploadDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5">
                          {doc.tags.map((tag, idx) => (
                            <span
                              key={`${doc.id}-${idx}`}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-blue-600 dark:text-white shadow-sm"
                            >
                              <TagIcon className="h-3 w-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                            <PencilIcon className="h-5 w-5" />
                            <span className="sr-only">Edit</span>
                          </button>
                          <button className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">
                            <ShareIcon className="h-5 w-5" />
                            <span className="sr-only">Share</span>
                          </button>
                          <button className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                            <TrashIcon className="h-5 w-5" />
                            <span className="sr-only">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Bottom navigation */}
        <div className="mt-8 flex flex-col md:flex-row md:justify-between">
          <div className="mb-4 md:mb-0">
            <Link 
              href="/dashboard/healthcare"
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
            >
              ← Back to Health Dashboard
            </Link>
          </div>
          <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Download All Documents
            </button>
            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Export Document List
            </button>
            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Help & Support
            </button>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Upload Secure Document</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Category
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                  <option>Select a category</option>
                  <option value="insurance">Insurance</option>
                  <option value="medical">Medical</option>
                  <option value="identification">Identification</option>
                  <option value="financial">Financial</option>
                  <option value="legal">Legal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Tags (separate with commas)
                </label>
                <input 
                  type="text" 
                  placeholder="insurance, policy, healthcare" 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                />
              </div>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <ArrowUpTrayIcon className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Drag and drop your document here or
                </p>
                <button 
                  type="button" 
                  className="text-sm text-red-600 dark:text-red-400 font-medium"
                >
                  browse files
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Supported formats: PDF, JPG, PNG, DOC, DOCX
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="flex items-start">
                  <LockClosedIcon className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Documents are encrypted before uploading. Only you can access them.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Upload Securely
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Scan Document</h3>
              <button 
                onClick={() => setShowScanModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-center mb-6">
              <QrCodeIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Scan from Mobile Device</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use your mobile device to scan documents directly into your secure vault
              </p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 mb-6">
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                <li>Open the Life Navigator app on your mobile device</li>
                <li>Go to "Scan Document" in the menu</li>
                <li>Position your document in the scanner view</li>
                <li>Take the photo and adjust the cropping</li>
                <li>Document will be automatically encrypted and uploaded</li>
              </ol>
            </div>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
              Don't have the mobile app?
            </p>
            <div className="flex justify-center mb-4">
              <button
                type="button"
                className="flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.67-.546 9.103 1.519 12.08 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.058 2.092-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"></path>
                </svg>
                App Store
              </button>
              <button
                type="button"
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 ml-3"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 20.69a2.9 2.9 0 001.28 1.17c.42.16.88.12 1.32-.08l.36-.2c.42-.23.78-.55 1.06-.94.57-.87.7-1.9.33-2.85l-.19-.48a.72.72 0 01.17-.75l.24-.24c.24-.24.6-.33.92-.24l.5.14c1.22.35 2.54-.07 3.32-1.05l.27-.35c.48-.62.77-1.36.82-2.13.05-.85-.18-1.7-.66-2.42L5.15 4.4a2.44 2.44 0 00-2.98-.7l-.3.15c-.66.33-1.2.84-1.55 1.5-.38.8-.46 1.68-.24 2.53l.22.84c.14.53.13 1.09-.01 1.62l-.7 2.7c-.23.87-.04 1.8.5 2.52M17 4.5a2.5 2.5 0 00-2.5 2.5A2.5 2.5 0 0017 9.5a2.5 2.5 0 002.5-2.5A2.5 2.5 0 0017 4.5m0 5.5c-1.7 0-3.1-1.3-3.1-3s1.4-3 3.1-3 3.1 1.3 3.1 3-1.4 3-3.1 3m3-10c-5 0-9.3 3-11.2 7.2.9.9 1.6 1.9 2 3.1 1.3-3.9 4.9-6.8 9.2-6.8 5.3 0 9.6 4.3 9.6 9.6 0 5.3-4.3 9.6-9.6 9.6-4.1 0-7.5-2.5-8.9-6.1-.8.3-1.7.5-2.6.5-.1 0-.3 0-.4-.1C9.7 21.5 13.1 24 17 24c6.6 0 12-5.4 12-12S23.6 0 17 0"></path>
                </svg>
                Play Store
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}