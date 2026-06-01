'use client'

import { UserCircle2 } from 'lucide-react'
import { useProInvestProfile } from '@/hooks/useProInvestProfile'
import { ProInvestProfileForm } from './ProInvestProfileForm'

export function ProInvestProfile() {
  const { profile, loading, saving, error, saveField } = useProInvestProfile()

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <UserCircle2 size={18} className="text-amber-600" strokeWidth={1.9} aria-hidden />
        <h2 className="text-[14px] font-bold text-gray-900">투자 프로필</h2>
      </div>
      <ProInvestProfileForm
        profile={profile}
        loading={loading}
        saving={saving}
        error={error}
        saveField={saveField}
      />
    </div>
  )
}
