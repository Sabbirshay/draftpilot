'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import DashboardHeader, { DashboardTab } from '@/components/dashboard/DashboardHeader';
import { DateRangeState } from '@/components/dashboard/DateRangePicker';
import OverviewBento from '@/components/dashboard/OverviewBento';
import MacrosManager from '@/components/dashboard/MacrosManager';
import TeamManager from '@/components/dashboard/TeamManager';
import BillingManager from '@/components/dashboard/BillingManager';
import GmailSyncManager from '@/components/dashboard/GmailSyncManager';
import OnboardingDashboard from '@/components/dashboard/OnboardingDashboard';

const INITIAL_DATE_RANGE: DateRangeState = {
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  label: 'Aug 01 – Aug 31',
  compareStartDate: '2026-07-01',
  compareEndDate: '2026-07-31',
  compareLabel: 'Jul 01 – Jul 31',
  granularity: 'Daily',
};

export default function DashboardPage() {
  const { session, dbUser, onboardingState, isLoading, isFirstLogin, refreshOnboardingState } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [dateRange, setDateRange] = useState<DateRangeState>(INITIAL_DATE_RANGE);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [skipOnboarding, setSkipOnboarding] = useState(false);

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !session) {
      window.location.href = '/login';
    }
  }, [isLoading, session]);

  // Determine if we should show onboarding
  useEffect(() => {
    if (!isLoading && onboardingState && !skipOnboarding) {
      const isNewUser = !onboardingState.gmail_connected &&
        !onboardingState.first_macro_added &&
        !onboardingState.extension_installed;
      setShowOnboarding(isNewUser || isFirstLogin);
    }
  }, [isLoading, onboardingState, isFirstLogin, skipOnboarding]);

  const handleUpdateOnboarding = useCallback(async (updates: Partial<{
    gmail_connected: boolean;
    first_macro_added: boolean;
    extension_installed: boolean;
    viewed_demo: boolean;
  }>) => {
    try {
      const token = session?.access_token;
      if (!token) return;
      const { updateOnboardingState } = await import('@/lib/api');
      await updateOnboardingState(token, updates);
      await refreshOnboardingState();
    } catch (err) {
      console.error('Failed to update onboarding:', err);
    }
  }, [session, refreshOnboardingState]);

  const handleAddMacro = () => {
    setActiveTab('macros');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
            <svg className="w-6 h-6 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <p className="text-sm text-text-muted">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // No session — will redirect
  if (!session) {
    return null;
  }

  // Show onboarding for first-time users
  if (showOnboarding && !skipOnboarding) {
    return (
      <OnboardingDashboard
        userName={dbUser?.full_name || dbUser?.email || 'there'}
        onboardingState={onboardingState || {
          gmail_connected: false,
          first_macro_added: false,
          extension_installed: false,
          viewed_demo: false,
        }}
        onUpdateOnboarding={handleUpdateOnboarding}
        onNavigateToDashboard={() => setSkipOnboarding(true)}
      />
    );
  }

  // Regular dashboard for returning users
  return (
    <div className="min-h-screen bg-bg text-text pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="fixed top-10 left-1/4 w-[600px] h-[300px] bg-accent/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-[500px] h-[250px] bg-cyan/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header & Pill Navigation with Live Interactive Calendar */}
        <DashboardHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddMacroClick={handleAddMacro}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Tab Content Display */}
        <div>
          {activeTab === 'overview' && <OverviewBento dateRange={dateRange} />}
          {activeTab === 'macros' && <MacrosManager />}
          {activeTab === 'team' && <TeamManager />}
          {activeTab === 'billing' && <BillingManager />}
          {activeTab === 'gmail' && <GmailSyncManager />}
        </div>
      </div>
    </div>
  );
}
