'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import DashboardHeader, { DashboardTab } from '@/components/dashboard/DashboardHeader';
import { DateRangeState } from '@/components/dashboard/DateRangePicker';
import { getInitialDateRange } from '@/lib/date-utils';
import OverviewBento from '@/components/dashboard/OverviewBento';
import MacrosManager from '@/components/dashboard/MacrosManager';
import TeamManager from '@/components/dashboard/TeamManager';
import BillingManager from '@/components/dashboard/BillingManager';
import GmailSyncManager from '@/components/dashboard/GmailSyncManager';
import OnboardingDashboard from '@/components/dashboard/OnboardingDashboard';

const INITIAL_DATE_RANGE: DateRangeState = getInitialDateRange();

export default function DashboardPage() {
  const { session, user, dbUser, onboardingState, isLoading, isFirstLogin, updateOnboardingFlag } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [dateRange, setDateRange] = useState<DateRangeState>(INITIAL_DATE_RANGE);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [skipOnboarding, setSkipOnboarding] = useState(false);

  // Auth redirect if unauthenticated or unverified
  useEffect(() => {
    if (!isLoading) {
      if (!session) {
        window.location.href = '/login';
      } else if (user && user.email_confirmed_at === null) {
        window.location.href = '/login?unverified=true';
      }
    }
  }, [isLoading, session, user]);

  // Determine if we should show onboarding (shown for new users until Gmail is connected or they choose to explore)
  useEffect(() => {
    if (!isLoading && !skipOnboarding) {
      if (!onboardingState) {
        setShowOnboarding(true);
      } else {
        const isConnected = onboardingState.gmail_connected;
        setShowOnboarding(!isConnected || isFirstLogin);
      }
    }
  }, [isLoading, onboardingState, isFirstLogin, skipOnboarding]);

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

  // No session or unverified email — will redirect to login
  if (!session || (user && user.email_confirmed_at === null)) {
    return null;
  }

  // Show onboarding for new users
  if (showOnboarding && !skipOnboarding) {
    const displayName =
      dbUser?.full_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      dbUser?.email ||
      user?.email ||
      'there';

    return (
      <OnboardingDashboard
        userName={displayName}
        onboardingState={
          onboardingState || {
            gmail_connected: false,
            first_macro_added: false,
            extension_installed: false,
            viewed_demo: false,
          }
        }
        onUpdateOnboarding={updateOnboardingFlag}
        onNavigateToDashboard={() => {
          setSkipOnboarding(true);
          setShowOnboarding(false);
        }}
      />
    );
  }

  // Regular live dashboard for returning or connected users
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
          {activeTab === 'overview' && (
            <OverviewBento
              dateRange={dateRange}
              onNavigateToMacros={() => setActiveTab('macros')}
            />
          )}
          {activeTab === 'macros' && <MacrosManager />}
          {activeTab === 'team' && <TeamManager />}
          {activeTab === 'billing' && <BillingManager />}
          {activeTab === 'gmail' && <GmailSyncManager />}
        </div>
      </div>
    </div>
  );
}
