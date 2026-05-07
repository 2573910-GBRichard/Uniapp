import { supabase } from './supabase'

export async function sendEmployeeReport(recipient = 'richard@uniconcepts.com') {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.functions.invoke('send-employee-report', {
    body: { recipient },
  })

  if (error) {
    throw new Error(error.message || 'Failed to send employee report')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data
}
