const companyId = '112695'

function normalizeLocations(assignments = []) {
  return assignments
    .map((item) => ({
      id: item.location_id,
      name: item.name,
    }))
    .filter((item) => item.name)
}

function normalizeRoles(assignments = []) {
  return assignments
    .map((item) => ({
      id: item.role_id,
      name: item.role_name || item.name || '',
      isPrimary: Boolean(item.is_primary),
      locationId: item.location_id,
    }))
    .filter((item) => item.name)
}

function formatPrimaryRole(assignments = []) {
  if (!assignments.length) return 'Unassigned'

  const normalizedRoles = normalizeRoles(assignments)
  const primary = normalizedRoles.find((item) => item.isPrimary)
  return (primary ?? normalizedRoles[0])?.name || 'Unassigned'
}

function formatTrack(assignments = []) {
  const primaryRole = formatPrimaryRole(assignments)
  const lowered = primaryRole.toLowerCase()

  if (lowered.includes('cook') || lowered.includes('boh')) return 'Cook'
  if (lowered.includes('server')) return 'Server'
  if (lowered.includes('bar') || lowered.includes('bartender')) return 'Bar'
  if (lowered.includes('expo')) return 'Expo'
  if (lowered.includes('security') || lowered.includes('door')) return 'Security'
  if (lowered.includes('manager')) return 'Management'

  return primaryRole
}

export async function fetchSevenShiftsUsers() {
  const response = await fetch(`/api/7shifts/users?company_id=${companyId}`)

  if (!response.ok) {
    throw new Error('Unable to load 7shifts users')
  }

  const payload = await response.json()
  const results = Array.isArray(payload.results) ? payload.results : []
  const workingTodayIds = new Set(Array.isArray(payload.workingTodayUserIds) ? payload.workingTodayUserIds : [])
  const todayShifts = Array.isArray(payload.todayShifts) ? payload.todayShifts : []

  return results.map((user) => {
    const roleAssignments = Array.isArray(user.role_assignments) ? user.role_assignments : []
    const locationAssignments = Array.isArray(user.location_assignments) ? user.location_assignments : []
    const normalizedLocations = normalizeLocations(locationAssignments)
    const normalizedRoles = normalizeRoles(roleAssignments)
    const primaryRole = formatPrimaryRole(roleAssignments)
    const primaryLocation = normalizedLocations[0]?.name || 'Unassigned'
    const mobileNumber = user.mobile_number || ''
    const homeNumber = user.home_number || ''

    const scheduledShiftsToday = todayShifts.filter((shift) => shift?.user_id === user.id)

    return {
      id: user.id,
      name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      location: primaryLocation,
      allLocations: normalizedLocations,
      role: primaryRole,
      allRoles: normalizedRoles,
      startDate: user.hire_date ?? 'Unknown',
      track: formatTrack(roleAssignments),
      training: user.active ? 'Imported from 7shifts' : 'Inactive',
      compliance: user.invite_status === 'accepted' ? 'Invite accepted' : 'Needs review',
      type: user.type,
      email: user.email,
      phone: mobileNumber || homeNumber || '',
      mobileNumber,
      homeNumber,
      workingToday: workingTodayIds.has(user.id),
      scheduledToday: scheduledShiftsToday.length > 0,
      scheduledShiftsToday,
      active: user.active,
    }
  })
}
