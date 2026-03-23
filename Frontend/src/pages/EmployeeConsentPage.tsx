import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { authAPI } from '../services/api'

const REQUIRED_PHRASE = 'I provide my consent'

const EmployeeConsentPage = () => {
  const navigate = useNavigate()

  const employeeId = localStorage.getItem('employee_id') ?? ''
  const role = localStorage.getItem('role') ?? ''

  const [consentToRecording, setConsentToRecording] = useState<string>('')
  const [consentToAnalytics, setConsentToAnalytics] = useState<string>('')
  const [consentToPolicy, setConsentToPolicy] = useState<string>('')
  const [confirmationText, setConfirmationText] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAllowed = role === 'Employee' && employeeId.length > 0

  const allAccepted = useMemo(() => {
    return consentToRecording === 'yes' && consentToAnalytics === 'yes' && consentToPolicy === 'yes'
  }, [consentToRecording, consentToAnalytics, consentToPolicy])

  const phraseMatches = confirmationText.trim() === REQUIRED_PHRASE

  useEffect(() => {
    if (!isAllowed) {
      navigate('/login')
      return
    }

    if (localStorage.getItem('consent_given') === 'true') {
      navigate('/dashboard')
    }
  }, [isAllowed, navigate])

  if (!isAllowed) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!allAccepted) {
      setError('All consent declarations must be accepted to continue.')
      return
    }

    if (!phraseMatches) {
      setError('Please type the confirmation phrase exactly as shown.')
      return
    }

    try {
      setSubmitting(true)
      await authAPI.submitEmployeeConsent({
        employee_id: employeeId,
        consent_to_recording: true,
        consent_to_analytics: true,
        consent_to_policy: true,
        confirmation_text: confirmationText.trim(),
      })

      localStorage.setItem('consent_given', 'true')
      navigate('/dashboard')
    } catch (err) {
      const anyErr = err as any
      const detail = anyErr?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Unable to store consent. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.1),transparent_50%)]" />
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-3xl shadow-2xl p-6 sm:p-10"
        >
          <div className="flex items-start gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Employee Data Consent Agreement</h1>
              <p className="text-sm text-gray-600 mt-1">Required one-time acknowledgement before first access to the wellness dashboard.</p>
            </div>
          </div>

          <section className="rounded-2xl border border-primary-100 bg-white/70 p-5 sm:p-6 mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary-600" />
              Declaration Statement
            </h2>
            <p className="text-sm sm:text-[15px] text-gray-700 leading-relaxed">
              I acknowledge that this platform captures camera-based emotion indicators to support workplace wellness initiatives.
              I understand that captured data may be processed to generate individual and aggregated analytics for wellbeing monitoring,
              organisational trend analysis, and support planning. I confirm that participation is informed and voluntary under applicable
              internal policy and data-governance standards, and that this declaration is being provided prior to first-time use of the
              employee wellness system.
            </p>
          </section>

          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white/80 p-5 sm:p-6 space-y-5">
              <h3 className="text-lg font-semibold text-gray-800">Consent Questions</h3>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  1. Do you consent to being recorded by the wellness tracker camera while using this system?
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setConsentToRecording('yes')} className={`px-4 py-2 rounded-lg border text-sm ${consentToRecording === 'yes' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700'}`}>Yes, I consent</button>
                  <button type="button" onClick={() => setConsentToRecording('no')} className={`px-4 py-2 rounded-lg border text-sm ${consentToRecording === 'no' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-300 text-gray-700'}`}>No, I do not consent</button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  2. Do you consent to this data being used for wellness analytics and organisational insights?
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setConsentToAnalytics('yes')} className={`px-4 py-2 rounded-lg border text-sm ${consentToAnalytics === 'yes' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700'}`}>Yes, I consent</button>
                  <button type="button" onClick={() => setConsentToAnalytics('no')} className={`px-4 py-2 rounded-lg border text-sm ${consentToAnalytics === 'no' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-300 text-gray-700'}`}>No, I do not consent</button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  3. Do you confirm you have read and understood the declaration above and agree to proceed under these terms?
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setConsentToPolicy('yes')} className={`px-4 py-2 rounded-lg border text-sm ${consentToPolicy === 'yes' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700'}`}>Yes, I confirm</button>
                  <button type="button" onClick={() => setConsentToPolicy('no')} className={`px-4 py-2 rounded-lg border text-sm ${consentToPolicy === 'no' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-300 text-gray-700'}`}>No, I do not confirm</button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 sm:p-6">
              <label htmlFor="consentText" className="block text-sm font-semibold text-gray-800 mb-2">
                Final Confirmation
              </label>
              <p className="text-xs text-gray-600 mb-2">
                To finalize consent, type the exact phrase below:
              </p>
              <p className="font-mono text-sm bg-white border border-indigo-200 rounded-lg px-3 py-2 text-indigo-700 mb-3 inline-block">
                {REQUIRED_PHRASE}
              </p>
              <input
                id="consentText"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type the exact phrase"
                className="w-full px-4 py-3 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none smooth-transition bg-white"
              />
            </section>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-xs text-gray-600 leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary-600 flex-shrink-0" />
              <span>
                This one-time consent applies only to Employee role access. HR/Manager role access does not use this consent flow.
                If consent is not provided, dashboard access is restricted.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || !allAccepted || !phraseMatches}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-white font-semibold bg-gradient-to-r from-primary-600 to-indigo-600 shadow-lg hover:shadow-xl smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting Consent...' : 'Submit Consent and Continue'}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  )
}

export default EmployeeConsentPage
