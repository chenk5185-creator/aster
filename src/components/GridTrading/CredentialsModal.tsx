import React, { useState } from 'react';
import { Modal, Button, Input } from '../common';
import { useCredentialsStore } from '../../stores';
import { Shield, Key, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CredentialsModal: React.FC<CredentialsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { hasCredentials, isUnlocked, saveCredentials, unlockCredentials, lockCredentials, clearCredentials } = useCredentialsStore();

  const [mode, setMode] = useState<'setup' | 'unlock'>(() => hasCredentials ? 'unlock' : 'setup');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async () => {
    setError('');

    if (!apiKey.trim()) {
      setError('API Key is required');
      return;
    }
    if (!apiSecret.trim()) {
      setError('API Secret is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      saveCredentials({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }, password);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    setError('');

    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      const success = unlockCredentials(password);
      if (success) {
        onClose();
      } else {
        setError('Incorrect password');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLock = () => {
    lockCredentials();
    onClose();
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all saved credentials?')) {
      clearCredentials();
      setMode('setup');
      setApiKey('');
      setApiSecret('');
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'setup') {
      handleSetup();
    } else {
      handleUnlock();
    }
  };

  // If already unlocked, show lock/clear options
  if (isUnlocked) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="API Credentials" size="sm">
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
            <Shield className="h-8 w-8 text-success" />
            <div>
              <div className="font-medium text-text-primary">Credentials Unlocked</div>
              <div className="text-sm text-text-secondary">
                Your API credentials are active and ready to use.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button variant="outline" onClick={handleLock} className="w-full">
              <Lock className="h-4 w-4 mr-2" />
              Lock Credentials
            </Button>
            <Button variant="ghost" onClick={handleClear} className="w-full text-error hover:bg-error/10">
              Clear All Credentials
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="API Credentials" size="sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg">
          <Key className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-text-primary mb-1">
              {mode === 'setup' ? 'Setup API Credentials' : 'Unlock Credentials'}
            </div>
            <div className="text-text-secondary">
              {mode === 'setup'
                ? 'Enter your ASTER API Key and Secret. They will be encrypted with your password.'
                : 'Enter your password to unlock your saved credentials.'}
            </div>
          </div>
        </div>

        {mode === 'setup' && (
          <>
            {/* API Key */}
            <Input
              label="API Key"
              value={apiKey}
              onChange={setApiKey}
              placeholder="Enter your API Key"
              leftIcon={<Key className="h-4 w-4" />}
            />

            {/* API Secret */}
            <div className="relative">
              <Input
                label="API Secret"
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={setApiSecret}
                placeholder="Enter your API Secret"
                leftIcon={<Shield className="h-4 w-4" />}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-9 text-text-muted hover:text-text-primary"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}

        {/* Password */}
        <div className="relative">
          <Input
            label={mode === 'setup' ? 'Encryption Password' : 'Password'}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            placeholder="Enter password"
            leftIcon={<Lock className="h-4 w-4" />}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-text-muted hover:text-text-primary"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Confirm Password (setup only) */}
        {mode === 'setup' && (
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm password"
            leftIcon={<Lock className="h-4 w-4" />}
          />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-error/10 rounded-lg text-sm text-error">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" className="flex-1" isLoading={isLoading}>
            {mode === 'setup' ? 'Save Credentials' : 'Unlock'}
          </Button>
        </div>

        {/* Mode Toggle */}
        {hasCredentials && mode === 'unlock' && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode('setup')}
              className="text-sm text-primary hover:underline"
            >
              Setup new credentials instead
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
};
