import { useState } from 'react'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { UserPlus, Upload, FileText, CheckCircle, Printer, Phone, Info, AlertCircle } from 'lucide-react'

const DCBA_LOGO = 'https://www.dwarkacourtbarassociation.com/images/logo.png'

export default function MemberOnboarding() {
  const [step, setStep] = useState(0) // 0=notes, 1=verify, 2=form, 3=preview, 4=done
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applicationNo, setApplicationNo] = useState('')

  const [form, setForm] = useState({
    member_name: '', father_name: '', dob: '',
    enrollment_no: '', enrollment_date: '',
    mobile: '', email: '', blood_group: '',
    residential_address: '', residential_phone: '',
    office_address: '', office_phone: '',
    chamber_no: '', chamber_phone: '',
    // Yes/No fields
    other_bar_assoc: 'No', other_bar_assoc_details: '',
    chamber_in_delhi: 'No', chamber_in_delhi_details: '',
    criminal_case: 'No', criminal_case_details: '',
    employment_since_enroll: 'No', employment_details: '',
    enroll_suspended: 'No', suspension_details: '',
    practice_exclusively_dwarka: 'Yes',
    // Proposer
    proposer_name: '', proposer_enrollment: '', proposer_member_no: '', proposer_address: '', proposer_mobile: '',
    // Seconder
    seconder_name: '', seconder_enrollment: '', seconder_member_no: '', seconder_address: '', seconder_mobile: '',
  })

  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  function handleSendOTP() {
    if (!mobile || mobile.length !== 10) return toast.error('Enter valid 10-digit mobile number')
    setOtpSent(true)
    toast.success('OTP sent to ' + mobile)
  }

  function handleVerifyOTP() {
    if (!form.enrollment_no) return toast.error('Enrollment No. is mandatory')
    if (otp.length < 4) return toast.error('Enter valid OTP')
    setForm(f => ({ ...f, mobile }))
    setStep(2)
    toast.success('Mobile verified!')
  }

  function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!form.member_name) return toast.error('Name required')
    if (!form.enrollment_no) return toast.error('Enrollment No. required')
    if (!form.residential_address) return toast.error('Residential address required')
    if (!form.proposer_name || !form.proposer_member_no) return toast.error('Proposer details required')
    if (!form.seconder_name || !form.seconder_member_no) return toast.error('Seconder details required')

    setSaving(true)
    try {
      const { count } = await supabase.from('member_applications')
        .select('*', { count: 'exact', head: true })
      const fy = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
        : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`
      const appNo = `DCBA/APP/${fy}/${String((count||0)+1).padStart(4,'0')}`
      setApplicationNo(appNo)

      const { error } = await supabase.from('member_applications').insert({
        application_no: appNo,
        member_name: form.member_name,
        father_name: form.father_name,
        dob: form.dob || null,
        enrollment_no: form.enrollment_no,
        enrollment_date: form.enrollment_date || null,
        mobile: form.mobile,
        email: form.email,
        blood_group: form.blood_group,
        residential_address: form.residential_address,
        residential_phone: form.residential_phone,
        office_address: form.office_address,
        office_phone: form.office_phone,
        chamber_no: form.chamber_no,
        chamber_phone: form.chamber_phone,
        other_bar_assoc: form.other_bar_assoc,
        other_bar_assoc_details: form.other_bar_assoc_details,
        chamber_in_delhi: form.chamber_in_delhi,
        chamber_in_delhi_details: form.chamber_in_delhi_details,
        criminal_case: form.criminal_case,
        criminal_case_details: form.criminal_case_details,
        employment_since_enroll: form.employment_since_enroll,
        employment_details: form.employment_details,
        enroll_suspended: form.enroll_suspended,
        suspension_details: form.suspension_details,
        practice_exclusively_dwarka: form.practice_exclusively_dwarka,
        proposer_name: form.proposer_name,
        proposer_enrollment: form.proposer_enrollment,
        proposer_member_no: form.proposer_member_no,
        proposer_address: form.proposer_address,
        proposer_mobile: form.proposer_mobile,
        seconder_name: form.seconder_name,
        seconder_enrollment: form.seconder_enrollment,
        seconder_member_no: form.seconder_member_no,
        seconder_address: form.seconder_address,
        seconder_mobile: form.seconder_mobile,
        status: 'submitted',
        applied_at: new Date().toISOString(),
      })
      if (error) throw error
      setStep(4)
      toast.success('Application submitted successfully!')
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  function handlePrint() {
    const printContent = document.getElementById('application-form-print')
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Membership Application — DCBA</title>
      <style>
        @page { margin: 12mm; size: A4; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }
        h1 { font-size: 15px; text-align: center; font-weight: bold; }
        h2 { font-size: 12px; text-align: center; margin-bottom: 10px; text-decoration: underline; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        td, th { border: 1px solid #999; padding: 4px 7px; font-size: 9.5px; }
        th { background: #f0f0f0; font-weight: bold; text-align: left; }
        .section { font-weight: bold; font-size: 10px; background: #e0e0e0; padding: 3px 7px; margin: 8px 0 4px; }
        .sig-row { display: flex; justify-content: space-between; margin-top: 24px; }
        .sig-box { text-align: center; width: 140px; border-top: 1px solid #000; padding-top: 3px; font-size: 9px; }
        .declaration { border: 1px solid #000; padding: 6px; font-size: 9px; margin-bottom: 8px; line-height: 1.5; }
        .yn { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; text-align: center; line-height: 12px; font-size: 8px; margin-right: 3px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head><body>${printContent.innerHTML}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  function yn(val) {
    return `<span class="yn">${val==='Yes'?'✓':''}</span> Yes &nbsp; <span class="yn">${val==='No'?'✓':''}</span> No`
  }

  const STEPS = ['Info', 'Verify', 'Fill Form', 'Preview', 'Done']

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white rounded-full mx-auto mb-3 flex items-center justify-center shadow-md">
            <img src={DCBA_LOGO} alt="DCBA" className="w-12 h-12 object-contain"
              onError={e => { e.target.parentElement.innerHTML = '<span style="font-weight:800;color:#1a3a5c;font-size:1.2rem">DC</span>' }} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">DWARKA COURT BAR ASSOCIATION</h1>
          <p className="text-sm text-gray-500">New Membership Application</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > i ? 'bg-green-500 text-white' : step === i ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > i ? '✓' : i+1}
              </div>
              <span className={`text-xs ${step === i ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length-1 && <div className="w-6 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        {/* ── STEP 0 — Notes & Info ── */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Eligibility */}
            <div className="card p-5">
              <h3 className="font-bold text-[#1a3a5c] text-base flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-blue-600" /> Eligibility & Notes
              </h3>
              <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                <li>Advocate enrolled with Bar Council of Delhi and mainly practicing in any Courts at Delhi would be eligible for membership.</li>
                <li>Submission of application ipso facto will not confer membership unless verified and approved.</li>
                <li>Information with regard to change of address or Mobile No. shall be furnished within a period of one month from the date of change.</li>
                <li>The address for communication for the office also need to be furnished, if different from residential address.</li>
              </ol>
            </div>

            {/* Fees */}
            <div className="card p-5">
              <h3 className="font-bold text-[#1a3a5c] text-base mb-3">💰 Subscription & Fees</h3>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Membership / Enrolment Fee', '₹ 600/-'],
                    ['Annual Subscription', '₹ 600/-'],
                    ['Cost of Application Form', '₹ 10/-'],
                    ['Identity Card Fee', '₹ 50/-'],
                  ].map(([label, amount]) => (
                    <tr key={label} className="border-b border-gray-100">
                      <td className="py-2 text-gray-600">{label}</td>
                      <td className="py-2 font-bold text-[#1a3a5c] text-right">{amount}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50">
                    <td className="py-2 font-bold text-blue-800">Total at Admission</td>
                    <td className="py-2 font-bold text-blue-800 text-right">₹ 1,260/-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Documents Required */}
            <div className="card p-5">
              <h3 className="font-bold text-[#1a3a5c] text-base mb-3">📎 Documents Required (Annexures)</h3>
              <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                <li>Enrolment Certificate of Bar Council of Delhi</li>
                <li>Graduation / Post Graduation Degree</li>
                <li>LL.B. Degree</li>
                <li>Proof of Date of Birth and Residence</li>
                <li>2 Passport Size Photographs</li>
              </ol>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">Please read all notes carefully before proceeding. Ensure you have all documents ready before submitting the application.</p>
            </div>

            <button onClick={() => setStep(1)} className="btn-primary w-full text-base py-3">
              Proceed to Apply →
            </button>
          </div>
        )}

        {/* ── STEP 1 — Verify Mobile ── */}
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-700" /> Verify Your Mobile
            </h2>
            <p className="text-sm text-gray-500">Enter your mobile number and Bar Council Enrollment No. to begin</p>
            <div>
              <label className="label">Mobile Number *</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={mobile} onChange={e => setMobile(e.target.value)}
                  placeholder="10-digit mobile number" maxLength={10} type="tel" data-no-upper />
                <button onClick={handleSendOTP} className="btn-primary whitespace-nowrap">Send OTP</button>
              </div>
            </div>
            <div>
              <label className="label">Bar Council Enrollment No. *</label>
              <input className="input" value={form.enrollment_no}
                onChange={e => setForm({ ...form, enrollment_no: e.target.value })}
                placeholder="e.g. D/1234/2020" />
            </div>
            {otpSent && (
              <div>
                <label className="label">Enter OTP</label>
                <div className="flex gap-2">
                  <input className="input flex-1 text-center text-2xl tracking-widest" value={otp}
                    onChange={e => setOtp(e.target.value)} placeholder="----" maxLength={6} data-no-upper />
                  <button onClick={handleVerifyOTP} className="btn-primary">Verify</button>
                </div>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              ℹ️ Your enrollment number will be used for identification. Please ensure it is correct.
            </div>
            <button onClick={() => setStep(0)} className="btn-secondary w-full">← Back to Info</button>
          </div>
        )}

        {/* ── STEP 2 — Fill Form ── */}
        {step === 2 && (
          <div className="card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-700" /> Application Form
            </h2>

            {/* Personal Details */}
            <div>
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-3">1. Personal Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Full Name * (in capital letters)</label>
                  <input className="input" value={form.member_name}
                    onChange={e => setForm({ ...form, member_name: e.target.value })} placeholder="FULL NAME" />
                </div>
                <div>
                  <label className="label">Father's / Husband's / Daughter's Name</label>
                  <input className="input" value={form.father_name}
                    onChange={e => setForm({ ...form, father_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input type="date" className="input" value={form.dob}
                    onChange={e => setForm({ ...form, dob: e.target.value })} />
                </div>
                <div>
                  <label className="label">Blood Group</label>
                  <select className="input" value={form.blood_group}
                    onChange={e => setForm({ ...form, blood_group: e.target.value })}>
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Bar Council Enrollment No. *</label>
                  <input className="input" value={form.enrollment_no}
                    onChange={e => setForm({ ...form, enrollment_no: e.target.value })} />
                </div>
                <div>
                  <label className="label">Enrollment Date</label>
                  <input type="date" className="input" value={form.enrollment_date}
                    onChange={e => setForm({ ...form, enrollment_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Mobile *</label>
                  <input className="input" value={form.mobile} type="tel" data-no-upper
                    onChange={e => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} data-no-upper
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div>
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-3">2. Address Details</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Residential Address *</label>
                    <textarea className="input h-14 resize-none" value={form.residential_address}
                      onChange={e => setForm({ ...form, residential_address: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Residential Phone</label>
                    <input className="input" value={form.residential_phone} type="tel" data-no-upper
                      onChange={e => setForm({ ...form, residential_phone: e.target.value })} placeholder="Landline/Mobile" />
                  </div>
                  <div>
                    <label className="label">Chamber No. (if any)</label>
                    <input className="input" value={form.chamber_no}
                      onChange={e => setForm({ ...form, chamber_no: e.target.value })} placeholder="e.g. CH.NO-441A, IV Floor" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Office Address</label>
                    <textarea className="input h-14 resize-none" value={form.office_address}
                      onChange={e => setForm({ ...form, office_address: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Office Phone</label>
                    <input className="input" value={form.office_phone} type="tel" data-no-upper
                      onChange={e => setForm({ ...form, office_phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Chamber Phone</label>
                    <input className="input" value={form.chamber_phone} type="tel" data-no-upper
                      onChange={e => setForm({ ...form, chamber_phone: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* Photo */}
            <div>
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-3">3. Photograph</p>
              <div className="flex items-center gap-4">
                <div className="w-20 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                  {photoPreview
                    ? <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />
                    : <span className="text-xs text-gray-400 text-center px-1">Passport Size Photo</span>
                  }
                </div>
                <div>
                  <label className="btn-secondary cursor-pointer flex items-center gap-2 text-sm">
                    <Upload className="w-4 h-4" /> Upload Photo
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  <p className="text-xs text-gray-400 mt-1">JPG/PNG, max 2MB</p>
                </div>
              </div>
            </div>

            {/* Yes/No Questions */}
            <div>
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-3">4. Declarations</p>
              <div className="space-y-3">
                {[
                  { key: 'other_bar_assoc', detailKey: 'other_bar_assoc_details', label: 'Are you a member of any other Bar Association in Delhi?' },
                  { key: 'chamber_in_delhi', detailKey: 'chamber_in_delhi_details', label: 'Do you have a chamber/seat in any court premises in Delhi?' },
                  { key: 'criminal_case', detailKey: 'criminal_case_details', label: 'Whether any criminal case, trial or investigation is pending against you?' },
                  { key: 'employment_since_enroll', detailKey: 'employment_details', label: 'Have you ever taken up any employment with any organisation since your enrolment with Bar Council of Delhi?' },
                  { key: 'enroll_suspended', detailKey: 'suspension_details', label: 'Has your enrolment ever been suspended by the Bar Council?' },
                ].map(q => (
                  <div key={q.key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-sm text-gray-700 mb-2">{q.label}</p>
                    <div className="flex gap-4">
                      {['Yes', 'No'].map(val => (
                        <label key={val} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name={q.key} value={val}
                            checked={form[q.key] === val}
                            onChange={() => setForm({ ...form, [q.key]: val })} />
                          <span className="text-sm font-medium">{val}</span>
                        </label>
                      ))}
                    </div>
                    {form[q.key] === 'Yes' && (
                      <input className="input mt-2 text-sm" placeholder="Please give details..."
                        value={form[q.detailKey]}
                        onChange={e => setForm({ ...form, [q.detailKey]: e.target.value })} />
                    )}
                  </div>
                ))}
                {/* Practice exclusively */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-sm text-gray-700 mb-2">Do you intend to practice exclusively in the Courts at Dwarka?</p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map(val => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="practice_exclusively_dwarka" value={val}
                          checked={form.practice_exclusively_dwarka === val}
                          onChange={() => setForm({ ...form, practice_exclusively_dwarka: val })} />
                        <span className="text-sm font-medium">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Proposed By */}
            <div>
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-3">5. Proposed By *</p>
              <div className="grid grid-cols-2 gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div>
                  <label className="label text-xs">Name *</label>
                  <input className="input" value={form.proposer_name}
                    onChange={e => setForm({ ...form, proposer_name: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Enrollment No.</label>
                  <input className="input" value={form.proposer_enrollment}
                    onChange={e => setForm({ ...form, proposer_enrollment: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Membership No. *</label>
                  <input className="input" value={form.proposer_member_no}
                    onChange={e => setForm({ ...form, proposer_member_no: e.target.value })} placeholder="A-001" />
                </div>
                <div>
                  <label className="label text-xs">Mobile</label>
                  <input className="input" value={form.proposer_mobile} type="tel" data-no-upper
                    onChange={e => setForm({ ...form, proposer_mobile: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Address</label>
                  <input className="input" value={form.proposer_address}
                    onChange={e => setForm({ ...form, proposer_address: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Seconded By */}
            <div>
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-3">6. Seconded By *</p>
              <div className="grid grid-cols-2 gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                <div>
                  <label className="label text-xs">Name *</label>
                  <input className="input" value={form.seconder_name}
                    onChange={e => setForm({ ...form, seconder_name: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Enrollment No.</label>
                  <input className="input" value={form.seconder_enrollment}
                    onChange={e => setForm({ ...form, seconder_enrollment: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Membership No. *</label>
                  <input className="input" value={form.seconder_member_no}
                    onChange={e => setForm({ ...form, seconder_member_no: e.target.value })} placeholder="A-001" />
                </div>
                <div>
                  <label className="label text-xs">Mobile</label>
                  <input className="input" value={form.seconder_mobile} type="tel" data-no-upper
                    onChange={e => setForm({ ...form, seconder_mobile: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Address</label>
                  <input className="input" value={form.seconder_address}
                    onChange={e => setForm({ ...form, seconder_address: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
              <button onClick={() => setStep(3)} className="btn-primary flex-1">Preview Application →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Preview + Print ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="card p-4 bg-yellow-50 border-yellow-200">
              <p className="text-sm font-semibold text-yellow-800">📋 Preview your application before printing</p>
              <p className="text-xs text-yellow-600 mt-1">Verify all details. Print the form, get signatures, and submit to DCBA office.</p>
            </div>

            {/* Printable Form */}
            <div id="application-form-print" className="card p-6">
              <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
                <div className="text-center flex-1">
                  <h1 className="text-lg font-bold">DWARKA COURT BAR ASSOCIATION (REGD.)</h1>
                  <p className="text-xs">Dwarka Court Complex, Sector-10, Dwarka, New Delhi-110 075</p>
                  <p className="text-xs">Mob.: 8826021615 · Tel.: 011-35017651 · E-mail: dwarkacourtbarassociation@gmail.com</p>
                  <h2 className="text-sm font-bold mt-2 underline">APPLICATION FORM FOR MEMBERSHIP</h2>
                  <p className="text-xs text-gray-500 mt-1">App. No: <strong>{applicationNo || '————'}</strong></p>
                </div>
                <div className="flex-shrink-0 ml-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`DCBA Application: ${applicationNo||'Pending'} | ${form.member_name} | Enroll: ${form.enrollment_no}`)}&bgcolor=ffffff&color=1a3a5c&margin=2`}
                    alt="QR" className="w-16 h-16 border border-gray-200 rounded"
                    onError={e => { e.target.style.display='none' }} />
                  <p className="text-center text-xs text-gray-400 mt-0.5">App. QR</p>
                </div>
              </div>

              <table className="w-full text-xs mb-3" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['1. Name (in capital letters)', form.member_name],
                    ['2. Father\'s / Husband\'s / Daughter\'s Name', form.father_name],
                    ['3. Date of Birth', form.dob],
                    ['4. Address Resi.', form.residential_address + (form.residential_phone ? `  Ph.: ${form.residential_phone}` : '')],
                    ['   Office', form.office_address + (form.office_phone ? `  Ph.: ${form.office_phone}` : '')],
                    ['   Chamber', form.chamber_no + (form.chamber_phone ? `  Ph.: ${form.chamber_phone}` : '')],
                    ['   Mob.', form.mobile + (form.email ? `  E-mail: ${form.email}` : '') + (form.blood_group ? `  Blood Group: ${form.blood_group}` : '')],
                    ['5. Bar Council Enrolment No.', form.enrollment_no + (form.enrollment_date ? `  Date: ${form.enrollment_date}` : '')],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5', width: '42%', textAlign: 'left', fontWeight: 'normal' }}>{label}</th>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{value || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Yes/No Questions */}
              <table className="w-full text-xs mb-3" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['6. Are you member of any other Bar Association in Delhi?', form.other_bar_assoc, form.other_bar_assoc_details],
                    ['7. Do you have a chamber/seat in any court premises in Delhi?', form.chamber_in_delhi, form.chamber_in_delhi_details],
                    ['8. Whether any criminal case, trial or investigation is pending against you?', form.criminal_case, form.criminal_case_details],
                    ['9. Have you ever taken up any employment since your enrolment with Bar Council of Delhi?', form.employment_since_enroll, form.employment_details],
                    ['10. Has your enrolment ever been suspended by the Bar Council?', form.enroll_suspended, form.suspension_details],
                    ['11. Do you intend to practice exclusively in the Courts at Dwarka?', form.practice_exclusively_dwarka, ''],
                  ].map(([label, val, details]) => (
                    <tr key={label}>
                      <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5', width: '62%', textAlign: 'left', fontWeight: 'normal' }}>{label}</th>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>
                        <span dangerouslySetInnerHTML={{ __html: `${val==='Yes'?'☑':'☐'} Yes &nbsp; ${val==='No'?'☑':'☐'} No${details ? `<br/><em>Details: ${details}</em>` : ''}` }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Proposed By / Seconded By */}
              <table className="w-full text-xs mb-3" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5', width: '15%' }}></th>
                    <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5' }}>Name</th>
                    <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5' }}>Enrolment No.</th>
                    <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5' }}>Membership No.</th>
                    <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5' }}>Mobile</th>
                    <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5' }}>Signature</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '4px 7px', fontWeight: 'bold' }}>Proposed By</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.proposer_name}</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.proposer_enrollment}</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.proposer_member_no}</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.proposer_mobile}</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px', height: '28px' }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '4px 7px', fontWeight: 'bold' }}>Seconded By</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.seconder_name}</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.seconder_enrollment}</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.seconder_member_no}</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.seconder_mobile}</td>
                    <td style={{ border: '1px solid #999', padding: '4px 7px', height: '28px' }}></td>
                  </tr>
                </tbody>
              </table>

              {/* Declaration */}
              <div style={{ border: '1px solid #000', padding: '6px', fontSize: '9px', marginBottom: '10px', lineHeight: '1.6' }}>
                <strong>Declaration:</strong> I do hereby declare that the information furnished herein above by me is true and correct. If found false, my application/membership shall be liable to be rejected. I shall abide by all the terms & conditions, rules and regulations of the Dwarka Court Bar Association, framed by the Bar Association.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <div style={{ textAlign: 'center', width: '130px' }}>
                  <div style={{ borderTop: '1px solid #000', paddingTop: '3px', fontSize: '9px' }}>AVNISH RANA<br/>President (DCBA)</div>
                </div>
                <div style={{ textAlign: 'center', width: '130px' }}>
                  <div style={{ borderTop: '1px solid #000', paddingTop: '3px', fontSize: '9px' }}>KARAN VEER TYAGI<br/>Hony. Secretary (DCBA)</div>
                </div>
                <div style={{ textAlign: 'center', width: '130px' }}>
                  <div style={{ borderTop: '1px solid #000', paddingTop: '3px', fontSize: '9px' }}>Signature of Applicant<br/>Date:</div>
                </div>
              </div>

              {/* Acknowledgment Slip */}
              <div style={{ borderTop: '2px dashed #000', marginTop: '16px', paddingTop: '10px' }}>
                <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginBottom: '8px' }}>Acknowledgment of Membership Application Form</p>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 0', width: '50%' }}>Name: <strong>{form.member_name || '___________________'}</strong></td>
                      <td style={{ padding: '3px 0' }}>Amount: ___________________</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0' }}>Father's Name: {form.father_name || '___________________'}</td>
                      <td style={{ padding: '3px 0' }}>Ch. No./Draft No.: ___________________</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0' }}>Mode of Payment: ___________________</td>
                      <td style={{ padding: '3px 0' }}>Name of Bank & Date: ___________________</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0' }}>Enrolment No.: {form.enrollment_no || '___________________'}</td>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontStyle: 'italic', fontSize: '9px' }}>(Signature of Staff of D.C.B.A. with stamp)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Edit</button>
              <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 flex-1">
                <Printer className="w-4 h-4" /> Print Form
              </button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4 — Done ── */}
        {step === 4 && (
          <div className="card p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Application Submitted!</h2>
            <p className="text-gray-500 mb-4">Your application has been submitted successfully.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-600">Application No.:</p>
              <p className="text-2xl font-bold text-blue-800">{applicationNo}</p>
            </div>
            <div className="text-sm text-gray-500 space-y-1 text-left bg-gray-50 rounded-xl p-4">
              <p className="font-bold text-gray-700 mb-2">📋 Next Steps:</p>
              <p>1. Print the application form using the button below</p>
              <p>2. Get signatures of Proposer and Seconder</p>
              <p>3. Submit signed form at DCBA office with:</p>
              <p className="ml-4">• Enrolment certificate of Bar Council of Delhi</p>
              <p className="ml-4">• Graduation / Post Graduation Degree</p>
              <p className="ml-4">• LL.B. Degree</p>
              <p className="ml-4">• Proof of Date of Birth and Residence</p>
              <p className="ml-4">• 2 Passport size Photographs</p>
              <p>4. Pay fees at office: Membership ₹600 + Annual Sub ₹600 + Form ₹10 + I-Card ₹50</p>
              <p>5. Membership will be activated after verification and approval</p>
            </div>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2 mx-auto mt-4">
              <Printer className="w-4 h-4" /> Print Application Form
            </button>

            {/* Hidden print div — same as Step 3 */}
            <div id="application-form-print" style={{ display: 'none' }}>
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                  <h1 style={{ fontSize: '15px', fontWeight: 'bold' }}>DWARKA COURT BAR ASSOCIATION (REGD.)</h1>
                  <p style={{ fontSize: '9px' }}>Dwarka Court Complex, Sector-10, Dwarka, New Delhi-110 075</p>
                  <p style={{ fontSize: '9px' }}>Mob.: 8826021615 · Tel.: 011-35017651 · E-mail: dwarkacourtbarassociation@gmail.com</p>
                  <h2 style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '6px', textDecoration: 'underline' }}>APPLICATION FORM FOR MEMBERSHIP</h2>
                  <p style={{ fontSize: '9px', color: '#555', marginTop: '4px' }}>App. No: <strong>{applicationNo}</strong></p>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                  <tbody>
                    {[
                      ['1. Name (in capital letters)', form.member_name],
                      ["2. Father's / Husband's / Daughter's Name", form.father_name],
                      ['3. Date of Birth', form.dob],
                      ['4. Address Resi.', form.residential_address + (form.residential_phone ? `  Ph.: ${form.residential_phone}` : '')],
                      ['   Office', form.office_address + (form.office_phone ? `  Ph.: ${form.office_phone}` : '')],
                      ['   Chamber', form.chamber_no + (form.chamber_phone ? `  Ph.: ${form.chamber_phone}` : '')],
                      ['   Mob.', form.mobile + (form.email ? `  E-mail: ${form.email}` : '') + (form.blood_group ? `  Blood Group: ${form.blood_group}` : '')],
                      ['5. Bar Council Enrolment No.', form.enrollment_no + (form.enrollment_date ? `  Date: ${form.enrollment_date}` : '')],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5', width: '42%', textAlign: 'left', fontWeight: 'normal' }}>{label}</th>
                        <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{value || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                  <tbody>
                    {[
                      ['6. Are you member of any other Bar Association in Delhi?', form.other_bar_assoc, form.other_bar_assoc_details],
                      ['7. Do you have a chamber/seat in any court premises in Delhi?', form.chamber_in_delhi, form.chamber_in_delhi_details],
                      ['8. Whether any criminal case, trial or investigation is pending against you?', form.criminal_case, form.criminal_case_details],
                      ['9. Have you ever taken up any employment since your enrolment with Bar Council of Delhi?', form.employment_since_enroll, form.employment_details],
                      ['10. Has your enrolment ever been suspended by the Bar Council?', form.enroll_suspended, form.suspension_details],
                      ['11. Do you intend to practice exclusively in the Courts at Dwarka?', form.practice_exclusively_dwarka, ''],
                    ].map(([label, val, details]) => (
                      <tr key={label}>
                        <th style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5', width: '62%', textAlign: 'left', fontWeight: 'normal' }}>{label}</th>
                        <td style={{ border: '1px solid #999', padding: '4px 7px' }}>
                          <span dangerouslySetInnerHTML={{ __html: `${val==='Yes'?'☑':'☐'} Yes &nbsp; ${val==='No'?'☑':'☐'} No${details ? `<br/><em>Details: ${details}</em>` : ''}` }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                  <thead>
                    <tr>
                      {['', 'Name', 'Enrolment No.', 'Membership No.', 'Mobile', 'Signature'].map(h => (
                        <th key={h} style={{ border: '1px solid #999', padding: '4px 7px', background: '#f5f5f5' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #999', padding: '4px 7px', fontWeight: 'bold' }}>Proposed By</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.proposer_name}</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.proposer_enrollment}</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.proposer_member_no}</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.proposer_mobile}</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px', height: '28px' }}></td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #999', padding: '4px 7px', fontWeight: 'bold' }}>Seconded By</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.seconder_name}</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.seconder_enrollment}</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.seconder_member_no}</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px' }}>{form.seconder_mobile}</td>
                      <td style={{ border: '1px solid #999', padding: '4px 7px', height: '28px' }}></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ border: '1px solid #000', padding: '6px', fontSize: '9px', marginBottom: '10px', lineHeight: '1.6' }}>
                  <strong>Declaration:</strong> I do hereby declare that the information furnished herein above by me is true and correct. If found false, my application/membership shall be liable to be rejected. I shall abide by all the terms & conditions, rules and regulations of the Dwarka Court Bar Association, framed by the Bar Association.
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <div style={{ textAlign: 'center', width: '130px' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '3px', fontSize: '9px' }}>AVNISH RANA<br/>President (DCBA)</div>
                  </div>
                  <div style={{ textAlign: 'center', width: '130px' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '3px', fontSize: '9px' }}>KARAN VEER TYAGI<br/>Hony. Secretary (DCBA)</div>
                  </div>
                  <div style={{ textAlign: 'center', width: '130px' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '3px', fontSize: '9px' }}>Signature of Applicant<br/>Date:</div>
                  </div>
                </div>

                <div style={{ borderTop: '2px dashed #000', marginTop: '16px', paddingTop: '10px' }}>
                  <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginBottom: '8px' }}>Acknowledgment of Membership Application Form</p>
                  <table style={{ width: '100%', fontSize: '9px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '3px 0', width: '50%' }}>Name: <strong>{form.member_name}</strong></td>
                        <td>Amount: ___________________</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0' }}>Father's Name: {form.father_name}</td>
                        <td>Ch. No./Draft No.: ___________________</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0' }}>Mode of Payment: ___________________</td>
                        <td>Name of Bank & Date: ___________________</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0' }}>Enrolment No.: {form.enrollment_no}</td>
                        <td style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '9px' }}>(Signature of Staff of D.C.B.A. with stamp)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
