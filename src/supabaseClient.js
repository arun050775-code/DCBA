import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xalbjrmridjgdpguobdx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhbGJqcm1yaWRqZ2RwZ3VvYmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMDMwODEsImV4cCI6MjA5MTg3OTA4MX0.NUd_8Wm8k_xc0TfOpSkL1CcRb_C0olPUnLavLxhqjm4'

export const supabase = createClient(supabaseUrl, supabaseKey)
