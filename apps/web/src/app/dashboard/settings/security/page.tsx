'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { toast } from '@/components/ui/toaster';
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';

export default function SecuritySettingsPage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // State for two-factor authentication
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  
  // Check MFA status on component mount
  React.useEffect(() => {
    const checkMfaStatus = async () => {
      try {
        const response = await fetch('/api/auth/mfa/status');
        if (response.ok) {
          const data = await response.json();
          setTwoFactorEnabled(data.enabled);
          
          // If recovery codes are available, store them
          if (data.recoveryCodes && data.recoveryCodes.length > 0) {
            setBackupCodes(data.recoveryCodes);
          }
        }
      } catch (error) {
        console.error('Error checking MFA status:', error);
      }
    };
    
    if (session?.user?.id) {
      checkMfaStatus();
    }
  }, [session]);
  
  // State for session management
  const [activeSessions, setActiveSessions] = useState([
    { id: '1', device: 'Chrome on Windows 10', location: 'Los Angeles, USA', lastActive: 'Just now', current: true },
    { id: '2', device: 'Safari on iPhone', location: 'San Francisco, USA', lastActive: '2 hours ago', current: false },
    { id: '3', device: 'Firefox on macOS', location: 'New York, USA', lastActive: '1 day ago', current: false },
  ]);
  
  // Function to validate password change
  const validatePasswordChange = () => {
    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Current password is required",
        type: "error",
      });
      return false;
    }
    
    if (!newPassword) {
      toast({
        title: "Error",
        description: "New password is required",
        type: "error",
      });
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        type: "error",
      });
      return false;
    }
    
    // Password strength validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters and include both letters and numbers",
        type: "error",
      });
      return false;
    }
    
    return true;
  };
  
  // Handle password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordChange()) return;
    
    setIsChangingPassword(true);
    
    try {
      // API call to change password would go here
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
      }
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      toast({
        title: "Success",
        description: "Your password has been changed successfully.",
        type: "success",
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password",
        type: "error",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  // Handle enabling two-factor authentication
  const handleEnableTwoFactor = async () => {
    try {
      // Call the API to set up MFA for the current user
      const response = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set up MFA');
      }
      
      const data = await response.json();
      
      // Set the QR code URL and show the setup UI
      setQrCodeUrl(data.qrCode);
      setShowTwoFactorSetup(true);
      
      // Get recovery codes
      const recoveryResponse = await fetch('/api/auth/mfa/status', {
        method: 'GET',
      });
      
      if (recoveryResponse.ok) {
        const recoveryData = await recoveryResponse.json();
        if (recoveryData.recoveryCodes) {
          setBackupCodes(recoveryData.recoveryCodes);
        }
      }
    } catch (error) {
      console.error('Error setting up MFA:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set up MFA",
        type: "error",
      });
    }
  };
  
  // Handle verifying two-factor setup
  const handleVerifyTwoFactor = async () => {
    // Verify the TOTP code
    if (verificationCode.length !== 6 || !/^\d+$/.test(verificationCode)) {
      toast({
        title: "Error",
        description: "Please enter a valid 6-digit verification code",
        type: "error",
      });
      return;
    }
    
    try {
      // Call the API to verify the MFA token
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: verificationCode,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid verification code');
      }
      
      // Call the API to enable MFA
      const enableResponse = await fetch('/api/auth/mfa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!enableResponse.ok) {
        const error = await enableResponse.json();
        throw new Error(error.message || 'Failed to enable MFA');
      }
      
      // Update UI state
      setTwoFactorEnabled(true);
      setShowTwoFactorSetup(false);
      
      toast({
        title: "Success",
        description: "Two-factor authentication has been enabled.",
        type: "success",
      });
    } catch (error) {
      console.error('Error verifying MFA:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify MFA code",
        type: "error",
      });
    }
  };
  
  // Handle disabling two-factor authentication
  const handleDisableTwoFactor = async () => {
    try {
      // Call the API to disable MFA
      const response = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to disable MFA');
      }
      
      // Update UI state
      setTwoFactorEnabled(false);
      
      toast({
        title: "Success",
        description: "Two-factor authentication has been disabled.",
        type: "success",
      });
    } catch (error) {
      console.error('Error disabling MFA:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disable MFA",
        type: "error",
      });
    }
  };

  // State for delete account modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleOpenDeleteModal = () => {
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };
  
  // Handle terminating a session
  const handleTerminateSession = (sessionId: string) => {
    // This would terminate the session in the backend
    setActiveSessions(activeSessions.filter(session => session.id !== sessionId));
    
    toast({
      title: "Success",
      description: "The session has been terminated.",
      type: "success",
    });
  };
  
  // Handle terminating all other sessions
  const handleTerminateAllSessions = () => {
    // This would terminate all sessions except the current one in the backend
    setActiveSessions(activeSessions.filter(session => session.current));
    
    toast({
      title: "Success",
      description: "All other sessions have been terminated.",
      type: "success",
    });
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Security Settings</h1>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
      />

      <div className="space-y-6">
        {/* Password Change Section */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Change Password</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Choose a strong, unique password that you don't use for other websites or applications.
            </p>
            
            <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Password must be at least 8 characters and include both letters and numbers.
                </p>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
              </div>
              
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </div>
        </Card>
        
        {/* Two-Factor Authentication Section */}
        <Card>
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Add an extra layer of security to your account by requiring a verification code in addition to your password.
                </p>
              </div>
              
              {twoFactorEnabled ? (
                <Button
                  variant="outline"
                  onClick={handleDisableTwoFactor}
                  className="text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-900/20"
                >
                  Disable
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleEnableTwoFactor}
                >
                  Enable
                </Button>
              )}
            </div>
            
            <div className="mt-2 flex items-center">
              <div className={`h-4 w-4 rounded-full ${twoFactorEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} mr-2`}></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {twoFactorEnabled ? 'Enabled' : 'Not enabled'}
              </span>
            </div>
            
            {showTwoFactorSetup && (
              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium mb-4">Set Up Two-Factor Authentication</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Scan this QR code with your authenticator app</h4>
                    <div className="bg-white p-4 inline-block rounded">
                      <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Enter the verification code from your app</h4>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.slice(0, 6))}
                        placeholder="6-digit code"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                        bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        maxLength={6}
                      />
                      <Button onClick={handleVerifyTwoFactor}>
                        Verify
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      3. Save these backup codes in a secure place
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Use these backup codes to sign in if you lose access to your authentication app.
                      Each code can only be used once.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, index) => (
                        <div key={index} className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono">
                          {code}
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" className="mt-4 text-sm">
                      Download Backup Codes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
        
        {/* Active Sessions Section */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Active Sessions</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              These are the devices that are currently logged into your account. You can terminate any session that you don't recognize.
            </p>
            
            <div className="space-y-4 mt-4">
              {activeSessions.map((session) => (
                <div key={session.id} className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <div>
                    <div className="flex items-center">
                      <span className="text-gray-900 dark:text-white font-medium">{session.device}</span>
                      {session.current && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {session.location} " Last active {session.lastActive}
                    </div>
                  </div>
                  
                  {!session.current && (
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      onClick={() => handleTerminateSession(session.id)}
                    >
                      Terminate
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            {activeSessions.length > 1 && (
              <div className="mt-6">
                <Button
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-900/20"
                  onClick={handleTerminateAllSessions}
                >
                  Terminate All Other Sessions
                </Button>
              </div>
            )}
          </div>
        </Card>
        
        {/* Login History Section */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Login History</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Recent login attempts to your account. If you notice any suspicious activity, please change your password immediately.
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Location
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Device
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      May 12, 2025, 10:30 AM
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      192.168.1.1
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      Los Angeles, USA
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      Chrome on Windows 10
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        Successful
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      May 11, 2025, 3:15 PM
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      192.168.1.2
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      San Francisco, USA
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      Safari on iPhone
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        Successful
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      May 10, 2025, 8:45 PM
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      192.168.1.3
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      Unknown
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      Unknown
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                        Failed
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Account Deletion Section */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">Danger Zone</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Actions in this section can't be undone. Be careful when making changes here.
            </p>

            <div className="border border-red-300 dark:border-red-700 rounded-md p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-red-600 dark:text-red-400">Delete Account</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleOpenDeleteModal}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}