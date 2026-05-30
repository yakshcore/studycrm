'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { SkeletonStat } from '@/components/Skeleton';
import { useToast } from '@/context/ToastContext';
import type { DashboardStats, LeadStatus, StudentStage } from '@/types';

const STUDENT_STAGES: { id: StudentStage; label: string }[] = [
  { id: 'inquiry',               label: 'Inquiry' },
  { id: 'counselling',           label: 'Counselling' },
  { id: 'university_selection',  label: 'University Selection' },
  { id: 'application_submitted', label: 'Application Submitted' },
  { id: 'offer_letter',          label: 'Offer Letter' },
  { id: 'fee_payment',           label: 'Fee Payment' },
  { id: 'cas_i20',               label: 'CAS / I-20' },
  { id: 'visa_filing',           label: 'Visa Filing' },
  { id: 'visa_approved',         label: 'Visa Approved' },
  { id: 'departure',             label: 'Departure' },
];

const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new',                 label: 'New',                 color: 'bg-indigo-500' },
  { id: 'contacted',           label: 'Contacted',           color: 'bg-blue-500' },
  { id: 'counselling',         label: 'Counselling',         color: 'bg-violet-500' },
  { id: 'interested',          label: 'Interested',          color: 'bg-amber-500' },
  { id: 'application_started', label: 'Application Started', color: 'bg-orange-500' },
  { id: 'closed_won',          label: 'Closed Won',          color: 'bg-emerald-500' },
  { id: 'closed_lost',         label: 'Closed Lost',         color: 'bg-red-500' },
];

interface MonthlyReports {
  monthlyStudents: number;
  monthlyVisaApprovals: number;
  monthlyRevenue: number;
}

export default function ReportsPage() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [monthly, setMonthly]   = useState<MonthlyReports | null>(null);
  const [loading, setLoading]   = useState(true);
  const { toast }               = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/reports'),
    ]).then(([sr, mr]) => {
      setStats(sr.data);
      setMonthly(mr.data);
    }).catch(() => toast('Failed to load reports', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const conversionRate = stats && stats.totalLeads > 0
    ? Math.round((stats.totalStudents / stats.totalLeads) * 100)
    : 0;

  const maxStudentStage = stats ? Math.max(...STUDENT_STAGES.map(s => stats.studentsByStage[s.id] || 0), 1) : 1;
  const maxLeadStatus   = stats ? Math.max(...LEAD_STATUSES.map(s => stats.leadsByStatus[s.id] || 0), 1) : 1;

  return (
    <div className="p-6 animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-t1">Reports</h1>
        <p className="text-t2 text-sm mt-1">Performance metrics and pipeline analytics</p>
      </div>

      {/* Monthly metrics */}
      <div>
        <h2 className="text-base font-semibold text-t1 mb-4">This Month</h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
            [...Array(4)].map((_, i) => <SkeletonStat key={i} />)
          ) : (
            <>
              <StatCard label="New Students"       value={monthly?.monthlyStudents || 0}         icon="🎓" color="indigo" />
              <StatCard label="Visa Approvals"     value={monthly?.monthlyVisaApprovals || 0}    icon="✅" color="emerald" />
              <StatCard label="Revenue"            value={`$${(monthly?.monthlyRevenue || 0).toLocaleString()}`} icon="💰" color="amber" />
              <StatCard label="Conversion Rate"    value={`${conversionRate}%`}                   icon="📊" color="violet" />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Student pipeline */}
        <div className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-base font-semibold text-t1 mb-5">Student Pipeline</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(10)].map((_, i) => <div key={i} className="h-5 bg-muted rounded animate-pulse" />)}</div>
          ) : stats ? (
            <div className="space-y-3">
              {STUDENT_STAGES.map(s => {
                const count = stats.studentsByStage[s.id] || 0;
                const pct   = (count / maxStudentStage) * 100;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-xs text-t2 w-36 flex-shrink-0 text-right">{s.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-t1 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Lead funnel */}
        <div className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-base font-semibold text-t1 mb-5">Lead Funnel</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(7)].map((_, i) => <div key={i} className="h-5 bg-muted rounded animate-pulse" />)}</div>
          ) : stats ? (
            <div className="space-y-3">
              {LEAD_STATUSES.map(s => {
                const count = stats.leadsByStatus[s.id] || 0;
                const pct   = (count / maxLeadStatus) * 100;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-xs text-t2 w-36 flex-shrink-0 text-right">{s.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${s.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-t1 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Overall totals */}
      {!loading && stats && (
        <div className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-base font-semibold text-t1 mb-4">Overall Totals</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Leads',        value: stats.totalLeads,        color: 'text-indigo-400' },
              { label: 'Total Students',     value: stats.totalStudents,     color: 'text-emerald-400' },
              { label: 'Total Applications', value: stats.totalApplications, color: 'text-blue-400' },
              { label: 'Visa Approvals',     value: stats.visaApprovals,     color: 'text-violet-400' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <p className={`text-4xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-t3 mt-1 uppercase tracking-wider">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
