'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeftIcon, CameraIcon, ArrowPathIcon, DocumentCheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function DocumentScanPage() {
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [documentCategory, setDocumentCategory] = useState('');
  const [documentTags, setDocumentTags] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropperRef = useRef<HTMLDivElement>(null);
  
  // Start camera when component mounts
  useEffect(() => {
    if (cameraActive && !capturedImage) {
      startCamera();
    }
    
    return () => {
      // Clean up camera stream
      if (videoRef.current && videoRef.current.srcObject) {
        const mediaStream = videoRef.current.srcObject as MediaStream;
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraActive, capturedImage]);
  
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Sorry, camera access is not supported by this browser');
        return;
      }
      
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Could not access camera. Please check permissions and try again.');
    }
  };
  
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to image data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageDataUrl);
        
        // Stop camera stream
        const mediaStream = video.srcObject as MediaStream;
        mediaStream.getTracks().forEach(track => track.stop());
        
        setIsCropping(true);
      }
    }
  };
  
  const retakePhoto = () => {
    setCapturedImage(null);
    setIsCropping(false);
    startCamera();
  };
  
  const processDocument = async () => {
    setIsProcessing(true);
    
    // Simulate document processing with OCR and encryption
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    setIsProcessing(false);
    setIsCompleted(true);
  };
  
  const handleCameraActivation = () => {
    setCameraActive(true);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center mb-6">
          <Link 
            href="/dashboard/healthcare/documents"
            className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Scanner</h1>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {!cameraActive && !capturedImage && !isCompleted && (
            <div className="p-8 text-center">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4 mx-auto w-20 h-20 flex items-center justify-center mb-4">
                <CameraIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Scan Documents with Your Camera</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Take a photo of your document and we'll automatically enhance, crop, and secure it for your vault.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <LockClosedIcon className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    All scanned documents are processed locally on your device and encrypted before being stored.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCameraActivation}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm"
              >
                <CameraIcon className="h-5 w-5 mr-2" />
                Start Camera
              </button>
            </div>
          )}
          
          {cameraActive && !capturedImage && (
            <div className="relative">
              <div className="aspect-[4/3] bg-black relative">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white border-opacity-70 rounded-md w-4/5 h-4/5"></div>
                </div>
                
                <div className="absolute bottom-4 inset-x-0 flex justify-center">
                  <button
                    onClick={captureImage}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg"
                  >
                    <div className="w-12 h-12 rounded-full border-4 border-red-600"></div>
                  </button>
                </div>
              </div>
              <div className="p-4 text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Position your document within the frame and ensure good lighting
                </p>
              </div>
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
          )}
          
          {capturedImage && isCropping && (
            <div>
              <div className="aspect-[4/3] bg-black relative overflow-hidden">
                <img 
                  src={capturedImage} 
                  className="absolute inset-0 w-full h-full object-contain"
                  alt="Captured document"
                />
                
                <div ref={cropperRef} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white border-opacity-70 rounded-md w-4/5 h-4/5"></div>
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Document Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="document-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Document Name
                    </label>
                    <input
                      id="document-name"
                      type="text"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      placeholder="e.g. Health Insurance Policy"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="document-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      id="document-category"
                      value={documentCategory}
                      onChange={(e) => setDocumentCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select a category</option>
                      <option value="insurance">Insurance</option>
                      <option value="medical">Medical</option>
                      <option value="identification">Identification</option>
                      <option value="financial">Financial</option>
                      <option value="legal">Legal</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="document-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tags (comma separated)
                    </label>
                    <input
                      id="document-tags"
                      type="text"
                      value={documentTags}
                      onChange={(e) => setDocumentTags(e.target.value)}
                      placeholder="e.g. insurance, healthcare, important"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                
                <div className="mt-6 flex justify-between">
                  <button
                    onClick={retakePhoto}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Retake Photo
                  </button>
                  <button
                    onClick={processDocument}
                    disabled={!documentName || !documentCategory}
                    className={`px-4 py-2 rounded-md text-white ${
                      documentName && documentCategory
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Process Document
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {isProcessing && (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-600 dark:border-red-400 mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Processing Document</h3>
              <div className="max-w-md mx-auto">
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  We're enhancing your document with OCR and applying encryption...
                </p>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 dark:bg-red-500 animate-pulse" style={{ width: '70%' }}></div>
                </div>
              </div>
            </div>
          )}
          
          {isCompleted && (
            <div className="p-12 text-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4 mx-auto w-20 h-20 flex items-center justify-center mb-4">
                <DocumentCheckIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Document Secured!</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your document has been successfully processed, encrypted, and added to your secure vault.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="flex items-center">
                  <LockClosedIcon className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-blue-700 dark:text-blue-400 text-left">
                    Document is secured with AES-256 encryption. Only you can access it with your account.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => {
                    setCameraActive(false);
                    setCapturedImage(null);
                    setIsCropping(false);
                    setIsProcessing(false);
                    setIsCompleted(false);
                    setDocumentName('');
                    setDocumentCategory('');
                    setDocumentTags('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ArrowPathIcon className="h-5 w-5 inline mr-2" />
                  Scan Another Document
                </button>
                <Link
                  href="/dashboard/healthcare/documents"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Go to Document Vault
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}