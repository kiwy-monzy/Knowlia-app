import React, { useState } from 'react';
import { Cloud, Eye, EyeOff } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface MegaLoginProps {
  onLoginSuccess: () => void;
}

const MegaLogin: React.FC<MegaLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfa, setMfa] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const result = await invoke<string>('mega_login', {
        email,
        password,
        mfa: mfa.trim() || null
      });
      
      console.log('MEGA login successful:', result);
      onLoginSuccess();
    } catch (err) {
      setError(err as string);
      console.error('MEGA login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <Cloud className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl font-semibold text-gray-900">Login to MEGA</h2>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="your-email@example.com"
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MFA Code (Optional)
            </label>
            <input
              type="text"
              value={mfa}
              onChange={(e) => setMfa(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter MFA code if enabled"
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Logging in...
              </div>
            ) : (
              'Login to MEGA'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MegaLogin;
