import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xalbjrmridjgdpguobdx.supabase.co'
const supabaseKey = 'sb_publishable_LuLFWWbmK8i9NQ8BV3SIZA__6Usbvfs'

export const supabase = createClient(supabaseUrl, supabaseKey)
