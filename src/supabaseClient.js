import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pwfmtihfnaumywrfwbnl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3Zm10aWhmbmF1bXl3cmZ3Ym5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjY4OTgsImV4cCI6MjA4MzA0Mjg5OH0.a6Q-Fmg0yWVgcIKknRnJslqu7S8-wzS_zH3KgstMii8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)