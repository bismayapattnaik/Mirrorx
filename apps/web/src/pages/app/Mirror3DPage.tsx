/**
 * @fileoverview 3D Virtual Mirror Page
 * Complete page component with onboarding flow and mirror view
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mirror3DOnboarding, Mirror3DView, STORAGE_KEYS } from '../../components/mirror3d';
import type { UserProfile } from '../../components/mirror3d';

type ViewState = 'loading' | 'onboarding' | 'mirror';

/**
 * Main 3D Mirror Page
 */
export function Mirror3DPage() {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Check if calibration is complete on mount
  useEffect(() => {
    const isCalibrated = localStorage.getItem(STORAGE_KEYS.CALIBRATION_COMPLETE);
    const savedProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);

    if (isCalibrated && savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
        setViewState('mirror');
      } catch {
        setViewState('onboarding');
      }
    } else {
      setViewState('onboarding');
    }
  }, []);

  /**
   * Handle onboarding completion
   */
  const handleOnboardingComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    setViewState('mirror');
  };

  /**
   * Handle skip onboarding
   */
  const handleSkipOnboarding = () => {
    setViewState('mirror');
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    navigate(-1);
  };

  /**
   * Handle reset calibration
   */
  const handleResetCalibration = () => {
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION_COMPLETE);
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    setUserProfile(null);
    setViewState('onboarding');
  };

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading 3D Mirror...</p>
        </div>
      </div>
    );
  }

  // Onboarding state
  if (viewState === 'onboarding') {
    return (
      <Mirror3DOnboarding
        onComplete={handleOnboardingComplete}
        onSkip={handleSkipOnboarding}
      />
    );
  }

  // Mirror view state
  return <Mirror3DView onBack={handleBack} />;
}

export default Mirror3DPage;
