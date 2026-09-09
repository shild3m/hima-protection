'use client'

import { useState, useEffect, useCallback } from 'react'
import {
 FaUserShield,
 FaSpinner,
 FaBoxOpen,
 FaCheck,
 FaTimes,
} from 'react-icons/fa'

interface Role {
 id: string
 name: string
 description: string | null
 created_at: string
}

interface Permission {
 id: string
 resource: string
 action: string
}

export default function RolesManager() {
 const [roles, setRoles] = useState<Role[]>([])
 const [permissions, setPermissions] = useState<Permission[]>([])
 const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
 const [loading, setLoading] = useState(true)
 const [selectedRole, setSelectedRole] = useState<Role | null>(null)

 const loadData = useCallback(async () => {
 setLoading(true)
 try {
 const { getRoles, getAllPermissions } = await import('@/app/actions/roles')
 const [rolesRes, permsRes] = await Promise.all([
 getRoles(),
 getAllPermissions(),
 ])
 if (rolesRes.success) setRoles(rolesRes.data || [])
 if (permsRes.success) setPermissions(permsRes.data || [])
 } finally {
 setLoading(false)
 }
 }, [])

 useEffect(() => { loadData() }, [loadData])

 const loadRolePermissions = async (roleId: string) => {
 try {
 const { getRolePermissions } = await import('@/app/actions/roles')
 const res = await getRolePermissions(roleId)
 if (res.success) {
 const perms = (res.data || []).map((rp: any) => rp.permissions?.resource + ':' + rp.permissions?.action)
 setRolePermissions(prev => ({ ...prev, [roleId]: perms }))
 }
 } catch { /* ignore */ }
 }

 const handleViewRole = async (role: Role) => {
 setSelectedRole(role)
 if (!rolePermissions[role.id]) {
 await loadRolePermissions(role.id)
 }
 }

 const groupedPermissions = permissions.reduce((acc, p) => {
 if (!acc[p.resource]) acc[p.resource] = []
 acc[p.resource].push(p)
 return acc
 }, {} as Record<string, Permission[]>)

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="mb-6">
 <h1 className="text-2xl font-black text-[#111214]">الأدوار</h1>
 <p className="text-[#62666D] text-sm mt-1">إدارة الأدوار والصلاحيات</p>
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-12 text-center">
 <FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">جاري التحميل...</p>
 </div>
 ) : roles.length === 0 ? (
 <div className="p-12 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">لا توجد أدوار</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
 {roles.map(role => (
 <div
 key={role.id}
 onClick={() => handleViewRole(role)}
 className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-4 hover:bg-[#F1F2F3] hover:border-white/[0.1] transition-all cursor-pointer"
 >
 <div className="flex items-center gap-3 mb-3">
 <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[#DC2626]">
 <FaUserShield className="text-sm" />
 </div>
 <div>
 <h3 className="text-[#111214] font-black text-sm">{role.name}</h3>
 {role.description && (
 <p className="text-[#62666D] text-xs">{role.description}</p>
 )}
 </div>
 </div>
 <p className="text-[#62666D] text-[10px]">
 الصلاحيات: {rolePermissions[role.id]?.length || '—'}
 </p>
 </div>
 ))}
 </div>
 )}
 </div>

 {selectedRole && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E8EA]">
 <h3 className="text-[#111214] font-black">صلاحيات {selectedRole.name}</h3>
 <button onClick={() => setSelectedRole(null)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]">
 <FaTimes className="text-sm" />
 </button>
 </div>
 <div className="p-6 overflow-y-auto max-h-[60vh]">
 {Object.entries(groupedPermissions).map(([resource, perms]) => (
 <div key={resource} className="mb-4">
 <h4 className="text-[#111214] font-bold text-sm mb-2">{resource}</h4>
 <div className="flex flex-wrap gap-2">
 {perms.map(p => {
 const hasPerm = rolePermissions[selectedRole.id]?.includes(`${p.resource}:${p.action}`)
 return (
 <span
 key={p.id}
 className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
 hasPerm
 ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
 : 'bg-[#F7F7F5] text-[#62666D] border border-[#E7E8EA]'
 }`}
 >
 {hasPerm && <FaCheck className="inline mr-1 text-[8px]" />}
 {p.action}
 </span>
 )
 })}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
