'use client';

import React, { useState } from 'react';
import DashboardHeader, { DashboardTab } from '@/components/dashboard/DashboardHeader';
import { DateRangeState } from '@/components/dashboard/DateRangePicker';
import OverviewBento from '@/components/dashboard/OverviewBento';
import MacrosManager from '@/components/dashboard/MacrosManager';
import TeamManager from '@/components/dashboard/TeamManager';
import BillingManager from '@/components/dashboard/BillingManager';
import GmailSyncManager from '@/components/dashboard/GmailSyncManager';

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
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [dateRange, setDateRange] = useState<DateRangeState>(INITIAL_DATE_RANGE);

  const handleAddMacro = () => {
    setActiveTab('macros');
  };

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
