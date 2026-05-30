'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { SkeletonStat } from '@/components/Skeleton';
import { useToast } from '@/context/ToastContext';
import type { DashboardStats, LeadStatus, StudentStage } from '@/types';

const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new',                 label: 'New',                 color: 'bg-indigo-500' },
  { id: 'contacted',           label: 'Contacted',           color: 'bg-blue-500' },
  { id: 'counselling',         label: 'Counselling',         color: 'bg-violet-500' },
  { id: 'interested',          label: 'Interested',          color: 'bg-amber-500' },
  { id: 'application_started', label: 'Application Started', color: 'bg-orange-500' },
  { id: 'closed_won',          label: 'Closed Won',          color: 'bg-emerald-500' },
  { id: 'closed_lost',         label: 'Closed Lost',         color: 'bg-red-500' },
];

const STUDENT_STAGES: { id: StudentStage; label: string }[] = [
  { id: 'inquiry',               label: 'Inquiry' },
  { id: 'counselling',           label: 'Counselling' },
  { id: 'university_selection',  label: 'Uni Selection' },
  { id: 'application_submitted', label: 'Applied' },
  { id: 'offer_letter',          label: 'Offer' },
  { id: 'fee_payment',           label: 'Fee Paid' },
  { id: 'cas_i20',               label: 'CAS/I-20' },
  { id: 'visa_filing',           label: 'Visa Filed' },
  { id: 'visa_approved',         label: 'Visa OK' },
  { id: 'departure',             label: 'Departed' },
];

export default function DashboardPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast }             = useToast();
  const router                = useRouter();

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(() => toast('Failed to load dashboard stats', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const maxLeadCount    = stats ? Math.max(...Object.values(stats.leadsByStatus || {}), 1) : 1;
  const maxStudentCount = stats ? Math.max(...Object.values(stats.studentsByStage || {}), 1) : 1;

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t1">Dashboard</h1>
          <p className="text-t2 text-sm mt-1">Overview of your study abroad pipeline</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/leads')}
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
          >
            + New Lead
          </button>
          <button
            onClick={() => router.push('/students')}
            className="px-4 py-2 rounded-xl bg-surface border border-line text-t1 text-sm font-semibold hover:bg-muted transition-colors"
          >
            + New Student
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading ? (
          [...Array(5)].map((_, i) => <SkeletonStat key={i} />)
        ) : stats ? (
          <>
            <StatCard label="Total Leads"        value={stats.totalLeads}       icon="🎯" color="indigo" />
            <StatCard label="Total Students"     value={stats.totalStudents}    icon="🎓" color="emerald" />
            <StatCard label="Applications"       value={stats.totalApplications}icon="📝" color="blue" />
            <StatCard label="Visa Approvals"     value={stats.visaApprovals}    icon="✅" color="violet" />
            <StatCard
              label="Pending Payments"
              value={`$${stats.pendingPaymentsTotal.toLocaleString()}`}
              icon="💳"
              color="amber"
            />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Lead pipeline */}
        <div className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-base font-semibold text-t1 mb-4">Lead Pipeline</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 h-3 bg-muted rounded animate-pulse" />
                  <div className="flex-1 h-3 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="space-y-3">
              {LEAD_STATUSES.map(s => {
                const count = stats.leadsByStatus[s.id] || 0;
                const pct   = maxLeadCount > 0 ? (count / maxLeadCount) * 100 : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-xs text-t2 w-28 flex-shrink-0 text-right">{s.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${s.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-t1 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Student journey */}
        <div className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="text-base font-semibold text-t1 mb-4">Student Journey</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 h-3 bg-muted rounded animate-pulse" />
                  <div className="flex-1 h-3 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="space-y-3">
              {STUDENT_STAGES.map(s => {
                const count = stats.studentsByStage[s.id] || 0;
                const pct   = maxStudentCount > 0 ? (count / maxStudentCount) * 100 : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-xs text-t2 w-28 flex-shrink-0 text-right">{s.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-t1 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
