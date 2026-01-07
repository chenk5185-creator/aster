import { useState } from 'react';
import { useCredentialsStore } from '../../stores';
import { SymbolSelector, CredentialsModal } from '../GridTrading';
import { Button } from '../common';
import { Grid3X3, Key, Lock, Unlock } from 'lucide-react';

export const Header: React.FC = () => {
  const { isUnlocked, hasCredentials } = useCredentialsStore();
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);

  return (
    <>
      <header className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Grid3X3 className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-xl font-bold text-text-primary">ASTER Grid</h1>
                  <p className="text-xs text-text-muted">Spot Trading</p>
                </div>
              </div>
            </div>

            {/* Symbol Selector */}
            <div className="flex-1 flex justify-center">
              <SymbolSelector />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Credentials Status */}
              <Button
                variant={isUnlocked ? 'outline' : 'primary'}
                size="sm"
                onClick={() => setShowCredentialsModal(true)}
              >
                {isUnlocked ? (
                  <>
                    <Unlock className="h-4 w-4 mr-2 text-success" />
                    <span className="text-success">Connected</span>
                  </>
                ) : hasCredentials ? (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Unlock
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Setup API
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Credentials Modal */}
      <CredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
      />
    </>
  );
};
