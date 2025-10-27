
const { createClient } = supabase;

const SUPABASE_URL = 'https://kptkfgohekpvebusongi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdGtmZ29oZWtwdmVidXNvbmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MjYwMzksImV4cCI6MjA3NTMwMjAzOX0.nB5BQCDNpqqwwYEEvc1aLV12V1H1KNnSC_sjtTN8KYk';

const clienteSupabase = createClient(SUPABASE_URL, SUPABASE_KEY);
