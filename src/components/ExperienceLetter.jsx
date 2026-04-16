import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Search, FileText, Printer, X, Mail, User } from 'lucide-react'

const OFFICE_BEARERS = [
  { name: 'ANIL KR. BASOYA', designation: 'HONY. SECRETARY' },
  { name: 'RAJPAL KASANA', designation: 'PRESIDENT' },
  { name: 'NARENDRA SHARMA', designation: 'VICE-PRESIDENT' },
  { name: 'HITESH BAISLA', designation: 'ADDL. SECRETARY' },
  { name: 'NIRDESH BIDHURI', designation: 'JOINT SECRETARY' },
  { name: 'POOJA ARORA', designation: 'TREASURER' },
]

const LEFT_PANEL_BEARERS = [
  { name: 'RAJPAL KASANA', designation: 'PRESIDENT', phone: '9810307671' },
  { name: 'NARENDRA SHARMA', designation: 'VICE-PRESIDENT', phone: '9212545556' },
  { name: 'ANIL KR. BASOYA', designation: 'HONY. SECRETARY', phone: '9899701777' },
  { name: 'HITESH BAISLA', designation: 'ADDL. SECRETARY', phone: '9899734554' },
  { name: 'NIRDESH BIDHURI', designation: 'JOINT SECRETARY', phone: '9999880051' },
  { name: 'POOJA ARORA', designation: 'TREASURER', phone: '9716303446' },
  { name: 'VIKRAM SINGH BIDHURI', designation: 'MEMBER LIBRARY', phone: '9810190007' },
  { name: 'BHARAT AHUJA', designation: 'SR. MEMBER EXECUTIVE\n(ABOVE 20 YEARS)', phone: '9810987109' },
  { name: 'AJAY KUMAR TANWAR', designation: 'SR. MEMBER EXECUTIVE\n(10-20 YEARS)', phone: '9871229143' },
  { name: 'YAMINI SHARMA', designation: 'SR. MEMBER EXECUTIVE\n(WOMEN-ABOVE 10 YEARS)', phone: '9312898472' },
  { name: 'GARIMA SINGH', designation: 'LADY MEMBER EXECUTIVE\n(BELOW 10 YEARS)', phone: '7042829677' },
  { name: 'NIKHIL RANA', designation: 'MEMBER EXECUTIVE\n(5-10 YEARS)', phone: '9870570037' },
  { name: 'PUNEET BASIST', designation: 'MEMBER EXECUTIVE\n(0-5 YEARS)', phone: '9999558950' },
]


function formatMembershipDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

async function generateLetterNo(orgId, shortName) {
  const fy = new Date().getMonth() >= 3
    ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
    : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`
  const { count } = await supabase.from('experience_letters').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
  const serial = String((count || 0) + 1).padStart(4, '0')
  return `${shortName}/EXP/${fy}/${serial}`
}

// Detect gender from name prefix
function getGenderTokens(name) {
  const upper = name.toUpperCase()
  if (upper.startsWith('MRS') || upper.startsWith('MS') || upper.startsWith('SMT') || upper.startsWith('KU')) {
    return { salutation: 'MS.', heshe: 'She', himher: 'her' }
  }
  return { salutation: 'MR.', heshe: 'He', himher: 'him' }
}

export default function ExperienceLetter() {
  const { currentOrg, userRole } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [signatory, setSignatory] = useState(OFFICE_BEARERS[0])
  const [letterNo, setLetterNo] = useState('')
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0])
  const [purpose, setPurpose] = useState('')
  const [searching, setSearching] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gender, setGender] = useState('auto') // 'auto', 'male', 'female'
  const printRef = useRef()

  // Compute tokens based on gender selection
  const tokens = (() => {
    if (gender === 'male') return { salutation: 'MR.', heshe: 'He', himher: 'him' }
    if (gender === 'female') return { salutation: 'MS.', heshe: 'She', himher: 'her' }
    return selectedMember ? getGenderTokens(selectedMember.member_name) : { salutation: 'MR.', heshe: 'He', himher: 'him' }
  })()

  async function handleSearch(query) {
    setSearchQuery(query)
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const { data } = await supabase
        .from('sba_members')
        .select('*')
        .or(`member_name.ilike.%${query}%,membership_no.ilike.%${query}%,enrollment_no.ilike.%${query}%`)
        .limit(10)
      setSearchResults(data || [])
    } catch (err) {
      console.error(err)
    }
    setSearching(false)
  }

  async function selectMember(member) {
    setSelectedMember(member)
    setSearchResults([])
    setSearchQuery(member.member_name)
    const no = await generateLetterNo(currentOrg.id, currentOrg.short_name)
    setLetterNo(no)
  }

  async function handleGenerate() {
    if (!selectedMember) return toast.error('Please select a member')
    if (!letterNo) return toast.error('Letter number missing')

    setSaving(true)
    try {
      const { error } = await supabase.from('experience_letters').insert({
        org_id: currentOrg.id,
        letter_no: letterNo,
        issue_date: letterDate,
        member_name: selectedMember.member_name,
        father_name: selectedMember.father_name,
        enrollment_no: selectedMember.enrollment_no,
        enrollment_date: selectedMember.membership_date,
        purpose: purpose,
        signatory_name: signatory.name,
        signatory_designation: signatory.designation,
        generated_by: userRole?.user_id,
      })
      if (error) throw error
      toast.success('Letter generated and logged!')
      setShowPrint(true)
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  function handlePrint() {
    // Exact margins from Word document (PRACTICE_CERTIFICATE.docx):
    // Left: 4111 twips = 72.5mm (pre-printed left panel width)
    // Top: 1276 twips = 22.5mm (pre-printed header height)
    // Right: 567 twips = 10mm
    // Bottom: 426 twips = 7.5mm
    // NOTE: use component-level `tokens` — includes gender override selection!

    const content = `
      <div style="
        font-family: 'Times New Roman', serif;
        font-size: 12pt;
        color: #000;
        line-height: 1.8;
      ">
        <!-- Ref No + Date row — at top after header -->
        <div style="display:flex; justify-content:space-between; font-size:11pt; margin-bottom:6pt; border-bottom:1px solid #000; padding-bottom:4pt;">
          <span>Ref. No. : <strong>${letterNo || '.....................'}</strong></span>
          <span>Dated : <strong>${letterDate ? formatDateDot(letterDate) : '.....................'}</strong></span>
        </div>

        <!-- Date right aligned -->
        <div style="text-align:right; margin-bottom:18pt; font-size:12pt;">
          ${letterDate ? formatDateDot(letterDate) : ''}
        </div>

        <!-- Subject -->
        <div style="text-align:center; font-weight:bold; text-decoration:underline; margin-bottom:18pt; font-size:12pt; letter-spacing:0.3px;">
          TO WHOMSOEVER IT MAY CONCERN
        </div>

        <!-- Para 1 -->
        <div style="text-align:justify; margin-bottom:14pt; text-indent:36pt; line-height:2;">
          This is to certify that <strong>${tokens.salutation} ${selectedMember?.member_name || ''}</strong>,
          Advocate as per record, is enrolled with the Bar Council of Delhi
          vide Enrollment No. <strong>${selectedMember?.enrollment_no || ''}</strong> and is a
          Member of the Saket Bar Association vide Membership No.
          <strong>${selectedMember?.membership_no || ''} dated ${formatMembershipDate(selectedMember?.membership_date)}.</strong>
        </div>

        <!-- Para 2 -->
        <div style="text-align:justify; margin-bottom:14pt; text-indent:36pt; line-height:2;">
          ${tokens.heshe} has been continuously practicing as an Advocate at District Courts, Saket, New Delhi.
        </div>

        <!-- Para 3 -->
        <div style="text-align:justify; margin-bottom:14pt; text-indent:36pt; line-height:2;">
          ${tokens.heshe} bears a good moral Character and I wish ${tokens.himher} all success.
        </div>

        <!-- Signature -->
        <div style="margin-top:50pt; text-align:right;">
          <div style="display:inline-block; width:80pt; height:80pt; border-radius:50%; border:1px dashed #ccc; margin-bottom:6pt;"></div>
          <br/>
          <strong style="font-size:13pt;">${signatory?.name}</strong><br/>
          <strong style="font-size:11pt;">${signatory?.designation}</strong>
        </div>
      </div>`

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Experience Letter - ${selectedMember?.member_name}</title>
      <style>
        @page {
          size: A4 portrait;
          margin-top: 22.5mm;
          margin-left: 72.5mm;
          margin-right: 10mm;
          margin-bottom: 7.5mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; padding: 0; font-family: 'Times New Roman', serif; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head><body>
      ${content}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-700" /> Experience Letter Generator
        </h1>
        <p className="text-gray-500 text-sm mt-1">{currentOrg?.name} — 16,304 members</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-gray-700">Member Details</h2>

          {/* Member Search */}
          <div>
            <label className="label">Search Member *</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input className="input pl-9" value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Name, Membership No. or Enrollment No." />
              {searching && <div className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</div>}
            </div>

            {/* Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg mt-1 shadow-lg bg-white max-h-48 overflow-y-auto z-10 relative">
                {searchResults.map(m => (
                  <button key={m.id} onClick={() => selectMember(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0">
                    <div className="font-medium text-gray-800 text-sm">{m.member_name}</div>
                    <div className="text-xs text-gray-500">{m.membership_no} · {m.enrollment_no}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Member Info */}
          {selectedMember && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-800">{selectedMember.member_name}</p>
                  <p className="text-blue-600">S/D/W of: {selectedMember.father_name}</p>
                  <p className="text-blue-600">Enrollment: {selectedMember.enrollment_no}</p>
                  <p className="text-blue-600">Membership: {selectedMember.membership_no} dated {formatMembershipDate(selectedMember.membership_date)}</p>
                  {selectedMember.mobile && <p className="text-blue-600">Mobile: {selectedMember.mobile}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Gender Override */}
          <div>
            <label className="label">Gender
              <span className="text-gray-400 font-normal ml-1">(auto-detect from name prefix)</span>
            </label>
            <div className="flex gap-2">
              {[
                { id: 'auto', label: '🔍 Auto Detect' },
                { id: 'male', label: '👨 Male (He/Him)' },
                { id: 'female', label: '👩 Female (She/Her)' },
              ].map(g => (
                <button key={g.id} type="button"
                  onClick={() => setGender(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${gender === g.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Using: <strong>{tokens.salutation} ... {tokens.heshe} ... {tokens.himher}</strong>
            </p>
          </div>

          {/* Letter details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Letter No.</label>
              <input className="input font-mono text-sm bg-gray-50" value={letterNo}
                onChange={e => setLetterNo(e.target.value)} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={letterDate}
                onChange={e => setLetterDate(e.target.value)} />
            </div>
          </div>

          {/* Signatory */}
          <div>
            <label className="label">Signatory (Office Bearer)</label>
            <select className="input" value={signatory.name}
              onChange={e => setSignatory(OFFICE_BEARERS.find(b => b.name === e.target.value))}>
              {OFFICE_BEARERS.map(b => (
                <option key={b.name} value={b.name}>{b.name} — {b.designation}</option>
              ))}
            </select>
          </div>

          {/* Purpose (optional) */}
          <div>
            <label className="label">Purpose <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" value={purpose} onChange={e => setPurpose(e.target.value)}
              placeholder="e.g. Bank purpose, Visa application..." />
          </div>

          <div className="flex gap-3">
            <button onClick={handleGenerate} disabled={!selectedMember || saving}
              className="btn-primary flex items-center gap-2 flex-1">
              <FileText className="w-4 h-4" />
              {saving ? 'Saving...' : 'Generate & Print'}
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">Preview</h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm" style={{ fontSize: '7px', transform: 'scale(1)', transformOrigin: 'top left' }}>
            <div ref={printRef}>
              <LetterPreview
                member={selectedMember}
                letterNo={letterNo}
                letterDate={letterDate}
                signatory={signatory}
                tokens={tokens}
              />
            </div>
          </div>
          {showPrint && (
            <div className="flex gap-2 mt-3">
              <button onClick={handlePrint} className="btn-primary flex items-center gap-2 flex-1">
                <Printer className="w-4 h-4" /> Print Letter
              </button>
              <button onClick={() => toast.success('Email coming soon!')} className="btn-secondary flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDateDot(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

function LetterPreview({ member, letterNo, letterDate, signatory, tokens }) {
  const s = {
    page: { fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', color: '#000', background: '#fff', padding: '0' },
    header: { textAlign: 'center', padding: '10px 16px 6px', borderBottom: '3px double #000' },
    h1: { fontSize: '17pt', fontWeight: 'bold', letterSpacing: '0.3px', margin: 0 },
    h2: { fontSize: '9pt', margin: '2px 0 0' },
    refDate: { display: 'flex', justifyContent: 'space-between', padding: '5px 16px', fontSize: '9pt', borderBottom: '1px solid #000' },
    body: { display: 'flex', minHeight: '220mm' },
    left: { width: '36mm', borderRight: '2px solid #000', padding: '8px 6px', fontSize: '6.5pt', lineHeight: '1.25' },
    bearer: { marginBottom: '7px' },
    bearerName: { fontWeight: 'bold', fontSize: '6.5pt', display: 'block' },
    bearerDesig: { fontSize: '6pt', display: 'block', color: '#444' },
    bearerPhone: { fontSize: '6pt', display: 'block', color: '#555' },
    right: { flex: 1, padding: '14px 20px' },
    date: { textAlign: 'right', marginBottom: '16px', fontSize: '11pt' },
    subject: { textAlign: 'center', fontSize: '11pt', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '18px', letterSpacing: '0.3px' },
    para: { fontSize: '11pt', lineHeight: '2', textAlign: 'justify', marginBottom: '12px', textIndent: '28px' },
    bold: { fontWeight: 'bold' },
    sigArea: { marginTop: '40px', textAlign: 'right', paddingRight: '16px' },
    sigName: { fontSize: '12pt', fontWeight: 'bold', display: 'block', marginTop: '8px' },
    sigDesig: { fontSize: '10pt', fontWeight: 'bold', display: 'block' },
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.h1}>SAKET BAR ASSOCIATION (REGD.)</div>
        <div style={s.h2}>SAKET COURT COMPLEX, NEW DELHI-110017</div>
        <div style={s.h2}>Phone : 011-47586747 &nbsp;|&nbsp; E-mail : saketbarassociation@gmail.com</div>
      </div>

      <div style={s.refDate}>
        <span>Ref. No. : <strong>{letterNo || '.....................'}</strong></span>
        <span>Dated : <strong>{letterDate ? formatDateDot(letterDate) : '.....................'}</strong></span>
      </div>

      <div style={s.body}>
        {/* Left Panel */}
        <div style={s.left}>
          {LEFT_PANEL_BEARERS.map(b => (
            <div key={b.name} style={s.bearer}>
              <span style={s.bearerName}>{b.name}</span>
              <span style={s.bearerDesig}>{b.designation}</span>
              <span style={s.bearerPhone}>{b.phone}</span>
            </div>
          ))}
        </div>

        {/* Right Panel */}
        <div style={s.right}>
          <div style={s.date}>{letterDate ? formatDateDot(letterDate) : '07.04.2026'}</div>
          <div style={s.subject}>TO WHOMSOEVER IT MAY CONCERN</div>

          <div style={s.para}>
            This is to certify that{' '}
            <span style={s.bold}>{tokens.salutation} {member?.member_name || 'MEMBER NAME'}</span>,
            Advocate as per record, is enrolled with the Bar Council of Delhi
            vide Enrollment No.{' '}
            <span style={s.bold}>{member?.enrollment_no || 'D/XXXX/XXXX'}</span>{' '}
            and is a Member of the Saket Bar Association vide
            Membership No.{' '}
            <span style={s.bold}>
              {member?.membership_no || 'M-XXXX'} dated {member ? formatMembershipDate(member.membership_date) : 'DD.MM.YYYY'}.
            </span>
          </div>

          <div style={s.para}>
            {tokens.heshe} has been continuously practicing as an
            Advocate at District Courts, Saket, New Delhi.
          </div>

          <div style={s.para}>
            {tokens.heshe} bears a good moral Character and I wish{' '}
            {tokens.himher} all success.
          </div>

          <div style={s.sigArea}>
            <div style={{ display: 'inline-block', width: '70px', height: '70px', borderRadius: '50%', border: '1px dashed #ccc', marginBottom: '4px', verticalAlign: 'bottom', marginRight: '8px' }}></div>
            <span style={s.sigName}>{signatory?.name}</span>
            <span style={s.sigDesig}>{signatory?.designation}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

