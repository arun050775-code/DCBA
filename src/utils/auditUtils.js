import { supabase } from '../supabaseClient'

// Check if entry can be edited/cancelled based on role and time
export function canEdit(entry, role, entryType = 'receipt') {
  if (!entry) return false
  if (entry.is_cancelled) return false
  if (role === 'admin') return true

  const createdAt = new Date(entry.created_at || entry.entry_date || entry.collection_date)
  const now = new Date()
  const hoursDiff = (now - createdAt) / (1000 * 60 * 60)

  if (entryType === 'receipt') {
    if (role === 'accountant') return true // accountant can always edit head
    if (role === 'supervisor') return hoursDiff <= 48
    return false // cashier cannot edit
  }

  if (entryType === 'payment') {
    if (role === 'accountant') return true
    if (role === 'supervisor') return hoursDiff <= 168 // 7 days
    return false
  }

  return false
}

export function canCancel(entry, role, entryType = 'receipt') {
  if (!entry) return false
  if (entry.is_cancelled) return false
  if (role === 'admin') return true

  const createdAt = new Date(entry.created_at || entry.entry_date || entry.collection_date)
  const now = new Date()
  const hoursDiff = (now - createdAt) / (1000 * 60 * 60)

  if (entryType === 'receipt') {
    if (role === 'cashier') return hoursDiff <= 24
    if (role === 'supervisor') return hoursDiff <= 48
    return false
  }

  if (entryType === 'payment') {
    if (role === 'supervisor') return hoursDiff <= 168
    return false
  }

  return false
}

// Log action to audit_log table
export async function logAudit({ orgId, tableName, recordId, action, oldData, newData, reason, userId, userName, userRole }) {
  await supabase.from('audit_log').insert({
    org_id: orgId,
    table_name: tableName,
    record_id: recordId,
    action,
    old_data: oldData || null,
    new_data: newData || null,
    reason: reason || null,
    done_by: userId,
    done_by_name: userName,
    done_by_role: userRole,
  })
}

export function timeLeftLabel(entry, role, entryType = 'receipt') {
  if (role === 'admin' || role === 'accountant') return null
  const createdAt = new Date(entry.created_at || entry.entry_date || entry.collection_date)
  const now = new Date()
  const hoursDiff = (now - createdAt) / (1000 * 60 * 60)

  let limitHours = 0
  if (entryType === 'receipt' && role === 'cashier') limitHours = 24
  if (entryType === 'receipt' && role === 'supervisor') limitHours = 48
  if (entryType === 'payment' && role === 'supervisor') limitHours = 168

  const hoursLeft = limitHours - hoursDiff
  if (hoursLeft <= 0) return 'Expired'
  if (hoursLeft < 1) return `${Math.floor(hoursLeft * 60)}m left`
  return `${Math.floor(hoursLeft)}h left`
}
