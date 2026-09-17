// ==========================================
// ⚙️ ตั้งค่า Supabase
// ==========================================
const SUPABASE_URL = 'https://tuybcnhygioveqozpmvi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1eWJjbmh5Z2lvdmVxb3pwbXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MDg1NzgsImV4cCI6MjEwNTE4NDU3OH0.i3wVj07KlcznZFG7mUVwEUygOe10z-1cueUbZzc5b5s';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// เดือนภาษาไทย
const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                'ก.ค.','ส.ค.','ก.ย.','ต.ค.', 'พ.ย.','ธ.ค.'];
const MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                     'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

// cache
let CATEGORIES = [];
let TEMPLATES = [];
let EXPENSES = [];
