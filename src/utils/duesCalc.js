// Rent vendor outstanding dues calculation
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function computeOutstanding(vendor) {
  if (!vendor || vendor.status !== 'active') return 0
  if (!vendor.monthly_rent) return vendor.opening_arrears || 0
  const today = new Date()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()
  if (!vendor.paid_upto_month || !vendor.paid_upto_year) return vendor.opening_arrears || 0
  let months = 0, yr = vendor.paid_upto_year, mo = vendor.paid_upto_month
  while (true) {
    mo++; if (mo > 12) { mo = 1; yr++ }
    if (yr > currentYear || (yr === currentYear && mo > currentMonth)) break
    months++
  }
  return months * vendor.monthly_rent + (vendor.opening_arrears || 0)
}

export function paidUptoLabel(vendor) {
  if (!vendor.paid_upto_month || !vendor.paid_upto_year) return 'Not set'
  return `${MONTHS_FULL[vendor.paid_upto_month - 1]} ${vendor.paid_upto_year}`
}

export function monthsDue(vendor) {
  if (!vendor.monthly_rent || !vendor.paid_upto_month || !vendor.paid_upto_year) return 0
  const today = new Date()
  let months = 0, yr = vendor.paid_upto_year, mo = vendor.paid_upto_month
  while (true) {
    mo++; if (mo > 12) { mo = 1; yr++ }
    if (yr > today.getFullYear() || (yr === today.getFullYear() && mo > today.getMonth() + 1)) break
    months++
  }
  return months
}
