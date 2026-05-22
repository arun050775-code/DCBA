import { useState } from 'react'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { UserPlus, Upload, FileText, CheckCircle, Printer, Phone } from 'lucide-react'

const DCBA_LOGO = 'https://www.dwarkacourtbarassociation.com/images/logo.png'

export default function MemberOnboarding() {
  const [step, setStep] = useState(1) // 1=verify, 2=form, 3=preview, 4=done
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [verified, setVerified] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applicationNo, setApplicationNo] = useState('')

  const [form, setForm] = useState({
    member_name: '',
    father_name: '',
    dob: '',
    enrollment_no: '',
    enrollment_date: '',
    mobile: '',
    email: '',
    residential_address: '',
    chamber_no: '',
    proposer1_member_no: '',
    proposer1_name: '',
    proposer2_member_no: '',
    proposer2_name: '',
  })

  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Step 1 — Mobile OTP verify
  function handleSendOTP() {
    if (!mobile || mobile.length !== 10) return toast.error('Enter valid 10-digit mobile number')
    // Simulate OTP send
    setOtpSent(true)
    toast.success('OTP sent to ' + mobile)
  }

  function handleVerifyOTP() {
    if (!form.enrollment_no) return toast.error('Enrollment No. is mandatory')
    if (otp.length < 4) return toast.error('Enter valid OTP')
    // For demo — accept any OTP
    setVerified(true)
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
    if (!form.proposer1_member_no || !form.proposer2_member_no) return toast.error('Both proposers required')

    setSaving(true)
    try {
      // Generate application no
      const { count } = await supabase.from('member_applications')
        .select('*', { count: 'exact', head: true })
      
      const fy = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
        : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`
      
      const appNo = `DCBA/APP/${fy}/${String((count||0)+1).padStart(4,'0')}`
      setApplicationNo(appNo)

      const { error } = await supabase.from('member_applications').insert({
        application_no: appNo,
        member_name: form.member_name.toUpperCase(),
        father_name: form.father_name.toUpperCase(),
        dob: form.dob || null,
        enrollment_no: form.enrollment_no,
        enrollment_date: form.enrollment_date || null,
        mobile: form.mobile,
        email: form.email,
        residential_address: form.residential_address,
        chamber_no: form.chamber_no,
        proposer1_member_no: form.proposer1_member_no,
        proposer1_name: form.proposer1_name,
        proposer2_member_no: form.proposer2_member_no,
        proposer2_name: form.proposer2_name,
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
        @page { margin: 15mm; size: A4; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
        h1 { font-size: 16px; text-align: center; font-weight: bold; }
        h2 { font-size: 13px; text-align: center; margin-bottom: 16px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        td, th { border: 1px solid #999; padding: 5px 8px; font-size: 10px; }
        th { background: #f0f0f0; font-weight: bold; text-align: left; }
        .section-title { font-weight: bold; font-size: 11px; background: #ddd; padding: 4px 8px; margin: 12px 0 6px; }
        .sig-row { display: flex; justify-content: space-between; margin-top: 32px; }
        .sig-box { text-align: center; width: 160px; border-top: 1px solid #000; padding-top: 4px; font-size: 10px; }
        .declaration { border: 1px solid #000; padding: 8px; font-size: 10px; margin-bottom: 12px; line-height: 1.6; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head><body>${printContent.innerHTML}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

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
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Verify', 'Fill Form', 'Preview', 'Done'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > i+1 ? 'bg-green-500 text-white' : step === i+1 ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > i+1 ? '✓' : i+1}
              </div>
              <span className={`text-xs ${step === i+1 ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>{s}</span>
              {i < 3 && <div className="w-8 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        {/* STEP 1 — Verify Mobile */}
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
                  placeholder="10-digit mobile number" maxLength={10} type="tel" />
                <button onClick={handleSendOTP} className="btn-primary whitespace-nowrap">
                  Send OTP
                </button>
              </div>
            </div>

            <div>
              <label className="label">Bar Council Enrollment No. * <span className="text-gray-400 font-normal">(mandatory for verification)</span></label>
              <input className="input" value={form.enrollment_no}
                onChange={e => setForm({ ...form, enrollment_no: e.target.value })}
                placeholder="e.g. D/1234/2020" />
            </div>

            {otpSent && (
              <div>
                <label className="label">Enter OTP</label>
                <div className="flex gap-2">
                  <input className="input flex-1 text-center text-2xl tracking-widest" value={otp}
                    onChange={e => setOtp(e.target.value)} placeholder="----" maxLength={6} />
                  <button onClick={handleVerifyOTP} className="btn-primary">
                    Verify
                  </button>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              ℹ️ Your enrollment number will be used for identification. Please ensure it is correct.
            </div>
          </div>
        )}

        {/* STEP 2 — Fill Form */}
        {step === 2 && (
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-700" /> Application Form
            </h2>

            {/* Personal Details */}
            <div className="section-header">
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">Personal Details</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Full Name * (as per Bar Council records)</label>
                <input className="input uppercase" value={form.member_name}
                  onChange={e => setForm({ ...form, member_name: e.target.value })}
                  placeholder="FULL NAME IN CAPITALS" />
              </div>
              <div>
                <label className="label">Father / Husband Name</label>
                <input className="input uppercase" value={form.father_name}
                  onChange={e => setForm({ ...form, father_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input type="date" className="input" value={form.dob}
                  onChange={e => setForm({ ...form, dob: e.target.value })} />
              </div>
              <div>
                <label className="label">Enrollment No. *</label>
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
                <input className="input" value={form.mobile}
                  onChange={e => setForm({ ...form, mobile: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Residential Address *</label>
                <textarea className="input h-16 resize-none" value={form.residential_address}
                  onChange={e => setForm({ ...form, residential_address: e.target.value })} />
              </div>
              <div>
                <label className="label">Chamber No. (if any)</label>
                <input className="input" value={form.chamber_no}
                  onChange={e => setForm({ ...form, chamber_no: e.target.value })}
                  placeholder="e.g. CH.NO-441A, IV Floor" />
              </div>
            </div>

            {/* Photo */}
            <div>
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-3">Photograph</p>
              <div className="flex items-center gap-4">
                <div className="w-20 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400 text-center px-1">Passport Size Photo</span>
                  )}
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

            {/* Proposers */}
            <div>
              <p className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-3">
                Proposed By * <span className="font-normal text-gray-500">(2 members, minimum 5 years membership)</span>
              </p>
              <div className="space-y-3">
                {[1, 2].map(n => (
                  <div key={n} className="grid grid-cols-2 gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <div>
                      <label className="label text-xs">Proposer {n} — Member No. *</label>
                      <input className="input" value={form[`proposer${n}_member_no`]}
                        onChange={e => setForm({ ...form, [`proposer${n}_member_no`]: e.target.value })}
                        placeholder="A-001" />
                    </div>
                    <div>
                      <label className="label text-xs">Proposer {n} — Name *</label>
                      <input className="input" value={form[`proposer${n}_name`]}
                        onChange={e => setForm({ ...form, [`proposer${n}_name`]: e.target.value })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(3)} className="btn-primary flex-1">
                Preview Application →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Preview + Print */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="card p-4 bg-yellow-50 border-yellow-200">
              <p className="text-sm font-semibold text-yellow-800">📋 Preview your application before printing</p>
              <p className="text-xs text-yellow-600 mt-1">Please verify all details carefully. Print the form, get proposers' signatures, and submit to DCBA office.</p>
            </div>

            {/* Printable form */}
            <div id="application-form-print" className="card p-6">
              <div className="text-center border-b-2 border-black pb-4 mb-4">
                <h1 className="text-lg font-bold">DWARKA COURT BAR ASSOCIATION (REGD.)</h1>
                <p className="text-xs">Dwarka Court Complex, Sector-10, New Delhi — 110075</p>
                <h2 className="text-base font-bold mt-2 underline">APPLICATION FOR MEMBERSHIP</h2>
              </div>

              <table className="w-full text-xs mb-4" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Full Name', form.member_name],
                    ['Father / Husband Name', form.father_name],
                    ['Date of Birth', form.dob],
                    ['Bar Council Enrollment No.', form.enrollment_no],
                    ['Enrollment Date', form.enrollment_date],
                    ['Mobile', form.mobile],
                    ['Email', form.email],
                    ['Residential Address', form.residential_address],
                    ['Chamber No.', form.chamber_no || '—'],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th style={{ border: '1px solid #999', padding: '5px 8px', background: '#f0f0f0', width: '40%', textAlign: 'left' }}>{label}</th>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{value || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-xs font-bold mb-2">PROPOSED BY:</p>
              <table className="w-full text-xs mb-4" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['', 'Member No.', 'Name', 'Signature'].map(h => (
                      <th key={h} style={{ border: '1px solid #999', padding: '5px 8px', background: '#f0f0f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Proposer 1</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{form.proposer1_member_no}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{form.proposer1_name}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', height: '30px' }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Proposer 2</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{form.proposer2_member_no}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{form.proposer2_name}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', height: '30px' }}></td>
                  </tr>
                </tbody>
              </table>

              <div style={{ border: '1px solid #000', padding: '8px', fontSize: '10px', marginBottom: '12px', lineHeight: '1.6' }}>
                <strong>DECLARATION:</strong> I hereby declare that the information furnished above is true and correct to the best of my knowledge. I am not a member of any other Bar Association for voting purposes. I agree to abide by the rules and regulations of the Dwarka Court Bar Association.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                <div style={{ textAlign: 'center', width: '120px' }}>
                  <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '10px' }}>Date</div>
                </div>
                <div style={{ textAlign: 'center', width: '120px' }}>
                  <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '10px' }}>Applicant Signature</div>
                </div>
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

        {/* STEP 4 — Done */}
        {step === 4 && (
          <div className="card p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Application Submitted!</h2>
            <p className="text-gray-500 mb-4">Your application has been submitted successfully.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-600">Application No.:</p>
              <p className="text-2xl font-bold text-blue-800">{applicationNo}</p>
            </div>
            <div className="text-sm text-gray-500 space-y-2 text-left bg-gray-50 rounded-xl p-4">
              <p>📋 <strong>Next steps:</strong></p>
              <p>1. Print the application form</p>
              <p>2. Get signatures of both proposers</p>
              <p>3. Submit the signed form at DCBA office along with:</p>
              <p className="ml-4">• Copy of Bar Council enrollment certificate</p>
              <p className="ml-4">• ID proof (Aadhar/PAN)</p>
              <p className="ml-4">• 2 passport size photographs</p>
              <p>4. Pay membership fees at office</p>
              <p>5. Your membership will be activated after verification</p>
            </div>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2 mx-auto mt-4">
              <Printer className="w-4 h-4" /> Print Application Form
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
