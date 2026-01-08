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
      setError('请输入 API Key');
      return;
    }
    if (!apiSecret.trim()) {
      setError('请输入 API Secret');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少需要 6 个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      await saveCredentials({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }, password);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存凭证失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    setError('');

    if (!password) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);
    try {
      const success = await unlockCredentials(password);
      if (success) {
        onClose();
      } else {
        setError('密码错误');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '解锁失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLock = () => {
    lockCredentials();
    onClose();
  };

  const handleClear = () => {
    if (confirm('确定要清除所有保存的凭证吗？此操作无法撤销。')) {
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
      <Modal isOpen={isOpen} onClose={onClose} title="API 凭证" size="sm">
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
            <Shield className="h-8 w-8 text-success" />
            <div>
              <div className="font-medium text-text-primary">凭证已解锁</div>
              <div className="text-sm text-text-secondary">
                您的 API 凭证已激活，可以开始使用。
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button variant="outline" onClick={handleLock} className="w-full">
              <Lock className="h-4 w-4 mr-2" />
              锁定凭证
            </Button>
            <Button variant="ghost" onClick={handleClear} className="w-full text-error hover:bg-error/10">
              清除所有凭证
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="API 凭证" size="sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg">
          <Key className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-text-primary mb-1">
              {mode === 'setup' ? '配置 API 凭证' : '解锁凭证'}
            </div>
            <div className="text-text-secondary">
              {mode === 'setup'
                ? '输入您的 ASTER API Key 和 Secret，它们将使用您的密码进行加密存储。'
                : '输入您的密码以解锁已保存的凭证。'}
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
              placeholder="输入您的 API Key"
              leftIcon={<Key className="h-4 w-4" />}
            />

            {/* API Secret */}
            <div className="relative">
              <Input
                label="API Secret"
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={setApiSecret}
                placeholder="输入您的 API Secret"
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
            label={mode === 'setup' ? '加密密码' : '密码'}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            placeholder="输入密码"
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
            label="确认密码"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="再次输入密码"
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
            {mode === 'setup' ? '保存凭证' : '解锁'}
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
              重新配置新凭证
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
};
