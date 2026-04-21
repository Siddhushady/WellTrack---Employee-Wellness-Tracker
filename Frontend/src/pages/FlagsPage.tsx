import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { adminAPI, FlaggedEmployee, type EmployeeEmotionSummary } from '../services/api'
import { ArrowLeft, Building2, ClipboardList, Download, Flame, Send, ShieldAlert, Sparkles } from 'lucide-react'

const printElement = (element: HTMLElement, title: string) => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    window.print()
    return
  }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => {
      if (node instanceof HTMLLinkElement) {
        return `<link rel="stylesheet" href="${node.href}">`
      }
      return node.outerHTML
    })
    .join('\n')

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        ${styles}
        <style>
          @page { size: A4; margin: 14mm; }
          html, body {
            background: #ffffff !important;
            margin: 0;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          article, section, .rounded-2xl, .rounded-3xl, h1, h2, h3, ul, ol {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>${element.outerHTML}</body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  window.setTimeout(() => printWindow.print(), 500)
}

const emptySummary = (
  emp: FlaggedEmployee,
  timeframe: 'week' | 'month',
  summary?: EmployeeEmotionSummary | null
): EmployeeEmotionSummary => {
  if (summary) return summary
  const today = new Date().toISOString().slice(0, 10)
  return {
    employee_id: emp.employee_id,
    department: emp.department,
    days: timeframe === 'week' ? 7 : 30,
    start_date: today,
    end_date: today,
    first_session_date: null,
    last_session_date: null,
    session_count: 0,
    active_days: 0,
    emotions: [],
  }
}

const orgReportComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-4 text-2xl font-black uppercase tracking-wide text-cyan-950">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-7 border-b border-cyan-200 pb-2 text-lg font-black uppercase tracking-wide text-cyan-900">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-teal-700">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-3 text-sm leading-7 text-slate-700">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-4 grid gap-2">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-4 list-decimal space-y-2 rounded-xl bg-cyan-50/70 p-4 pl-8">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="rounded-lg border border-cyan-100 bg-white px-3 py-2 text-sm leading-6 text-slate-700 shadow-sm marker:text-cyan-700">
      {children}
    </li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-black text-cyan-950">{children}</strong>
  ),
}

const riskReportComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-3 text-2xl font-black text-red-950">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-6 rounded-lg bg-red-700 px-4 py-2 text-base font-black uppercase tracking-wide text-white">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-5 border-l-4 border-red-600 pl-3 text-sm font-black uppercase tracking-wide text-red-800">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-3 text-sm leading-7 text-stone-800">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-4 space-y-2 border-l-4 border-red-200 pl-4">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-4 list-decimal space-y-2 border-l-4 border-red-200 pl-8">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-stone-800 marker:text-red-700">
      {children}
    </li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-black text-red-950">{children}</strong>
  ),
}

const FlaggedEmployeeCard = ({ emp, timeframe }: { emp: FlaggedEmployee, timeframe: 'week' | 'month' }) => {
  const reportRef = useRef<HTMLElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [agentStatus, setAgentStatus] = useState<{ agent: string; status: string; message: string } | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [summary, setSummary] = useState<EmployeeEmotionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alertStatus, setAlertStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isAlerting, setIsAlerting] = useState(false)

  const handleAnalyze = () => {
    if (isAnalyzing || result) return

    setIsAnalyzing(true)
    setAgentStatus(null)
    setResult(null)
    setSummary(null)
    setError(null)
    setAlertStatus(null)

    adminAPI.getEmployeeEmotionSummary(emp.employee_id, timeframe)
      .then(setSummary)
      .catch(err => {
        console.error('Failed to fetch flagged employee summary:', err)
      })

    const prompt = `Analyze this flagged employee's emotional trends over the past ${timeframe}. They were flagged because ${emp.negative_ratio.toFixed(1)}% of their emotions were negative. Why were they flagged? What specific interventions do you recommend?`
    const url = new URL(`${import.meta.env?.VITE_API_URL || 'http://localhost:8000'}/analyze/employee/stream`)
    url.searchParams.append('employee_id', emp.employee_id)
    url.searchParams.append('prompt', prompt)
    url.searchParams.append('timeframe', timeframe)

    const eventSource = new EventSource(url.toString())

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.status === 'complete') {
          if (data.summary && !data.summary.error) {
            setSummary(data.summary)
          }
          setResult(data.result)
          setIsAnalyzing(false)
          eventSource.close()
        } else if (data.status === 'error') {
          setError(data.message)
          setIsAnalyzing(false)
          eventSource.close()
        } else {
          setAgentStatus({ agent: data.agent, status: data.status, message: data.message })
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err)
      }
    }

    eventSource.onerror = () => {
      setError('Lost connection to the analysis server.')
      setIsAnalyzing(false)
      eventSource.close()
    }
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded && !result && !isAnalyzing) {
      handleAnalyze()
    }
  }

  const handleDownload = () => {
    if (reportRef.current) {
      printElement(reportRef.current, `${emp.employee_id}-burnout-risk-dossier`)
    }
  }

  const handleAlertEmployee = async () => {
    if (!result) return
    try {
      setIsAlerting(true)
      setAlertStatus(null)
      const sent = await adminAPI.sendEmployeeReport({
        employee_id: emp.employee_id,
        timeframe,
        report_type: 'flagged',
        report_content: result,
        report_summary: emptySummary(emp, timeframe, summary),
      })
      setAlertStatus({
        type: 'success',
        message: `Burnout risk alert made visible to ${sent.employee_id}.`,
      })
    } catch (err) {
      console.error('Failed to alert employee:', err)
      setAlertStatus({
        type: 'error',
        message: 'Unable to alert employee. Please confirm backend and database are running.',
      })
    } finally {
      setIsAlerting(false)
    }
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
      <div
        className="flex cursor-pointer items-center justify-between p-4 smooth-transition hover:bg-red-50/50"
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-sm font-black text-red-700">
            {emp.employee_id.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{emp.employee_id}</h3>
            <p className="text-sm text-gray-500">{emp.department}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-bold text-red-600">{emp.negative_ratio.toFixed(1)}% Negative</p>
            <p className="text-xs text-gray-500">{emp.negative_count} / {emp.total_count} detections</p>
          </div>
          <span className="text-xl font-bold text-gray-400">{isExpanded ? '-' : '+'}</span>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-red-100 bg-stone-50"
          >
            <div className="p-6">
              {(isAnalyzing || agentStatus) && !result && (
                <div className="mb-4 rounded-xl border border-red-100 bg-white p-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-red-800">
                    <Flame className="h-4 w-4" />
                    Risk Review In Progress
                  </h4>
                  {agentStatus && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {agentStatus.agent}
                      </span>
                      <span className="text-gray-600 text-xs">{agentStatus.message}</span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-bold">Error:</p>
                  <p>{error}</p>
                </div>
              )}

              {result && (
                <article ref={reportRef} className="overflow-hidden rounded-2xl border-2 border-red-200 bg-white shadow-lg">
                  <div className="bg-red-700 px-5 py-4 text-white">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-6 w-6" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-100">Burnout Risk Dossier</p>
                        <h3 className="text-xl font-black">{emp.employee_id}</h3>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 border-b border-red-100 bg-red-50 p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-red-700">Department</p>
                      <p className="text-sm font-black text-red-950">{emp.department}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-red-700">Negative Ratio</p>
                      <p className="text-sm font-black text-red-950">{emp.negative_ratio.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-red-700">Timeframe</p>
                      <p className="text-sm font-black text-red-950">{timeframe === 'week' ? 'Past Week' : 'Past Month'}</p>
                    </div>
                  </div>
                  <div className="p-6">
                    <ReactMarkdown components={riskReportComponents}>{result}</ReactMarkdown>
                  </div>
                </article>
              )}
              {result && (
                <div className="mt-4 flex flex-col gap-3">
                  {alertStatus && (
                    <div className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                      alertStatus.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}>
                      {alertStatus.message}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm smooth-transition hover:bg-red-50"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Report</span>
                    </button>
                    <button
                      onClick={handleAlertEmployee}
                      disabled={isAlerting}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm smooth-transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      <span>{isAlerting ? 'Alerting...' : 'Alert Employee'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const FlagsPage = () => {
  const navigate = useNavigate()
  const orgReportRef = useRef<HTMLElement>(null)
  const [timeframe, setTimeframe] = useState<'week' | 'month'>('month')
  const [flags, setFlags] = useState<FlaggedEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isGeneratingOrgReport, setIsGeneratingOrgReport] = useState(false)
  const [orgAgentStatus, setOrgAgentStatus] = useState<{ agent: string; status: string; message: string } | null>(null)
  const [orgReport, setOrgReport] = useState<string | null>(null)

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        setLoading(true)
        const data = await adminAPI.getFlags()
        setFlags(data)
      } catch (err) {
        console.error(err)
        setError('Failed to load flagged employees.')
      } finally {
        setLoading(false)
      }
    }
    fetchFlags()
  }, [])

  const handleGenerateOrgReport = () => {
    setIsGeneratingOrgReport(true)
    setOrgAgentStatus(null)
    setOrgReport(null)

    const url = new URL(`${import.meta.env?.VITE_API_URL || 'http://localhost:8000'}/analyze/flags/stream`)
    const eventSource = new EventSource(url.toString())

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.status === 'complete') {
          setOrgReport(data.result)
          setIsGeneratingOrgReport(false)
          eventSource.close()
        } else if (data.status === 'error') {
          console.error(data.message)
          setIsGeneratingOrgReport(false)
          eventSource.close()
        } else {
          setOrgAgentStatus({ agent: data.agent, status: data.status, message: data.message })
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err)
      }
    }
    eventSource.onerror = () => {
      setIsGeneratingOrgReport(false)
      eventSource.close()
    }
  }

  const handleDownloadOrgReport = () => {
    if (orgReportRef.current) {
      printElement(orgReportRef.current, 'organization-wide-flag-analysis')
    }
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.1),transparent_50%)]" />
      </div>
      <header className="glass-effect sticky top-0 z-10 border-b border-white/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 font-medium text-white smooth-transition hover:bg-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Employee Flags</h1>
              <p className="text-sm text-gray-500">Review employees showing concerning emotional trends</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4">
          <button
            onClick={handleGenerateOrgReport}
            disabled={isGeneratingOrgReport || flags.length === 0}
            className="group flex w-full flex-col items-start gap-4 rounded-2xl bg-gradient-to-br from-cyan-700 via-teal-700 to-slate-900 p-6 text-left text-white shadow-2xl shadow-cyan-200 smooth-transition hover:-translate-y-0.5 hover:shadow-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              {isGeneratingOrgReport ? (
                <Sparkles className="h-7 w-7 animate-pulse" />
              ) : (
                <Building2 className="h-8 w-8" />
              )}
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.24em] text-cyan-100">Organization</span>
              <span className="mt-1 block text-2xl font-black leading-tight">
                {isGeneratingOrgReport ? 'Generating...' : 'Org-Wide Report'}
              </span>
              <span className="mt-3 block text-sm leading-6 text-cyan-50">
                Create a leadership briefing from the current flagged employee patterns.
              </span>
            </span>
          </button>
        </aside>

        <section className="space-y-8">
          <AnimatePresence>
            {(isGeneratingOrgReport || orgReport) && (
              <motion.article
                ref={orgReportRef}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-xl"
              >
                <div className="bg-gradient-to-r from-cyan-900 via-teal-800 to-slate-900 px-6 py-6 text-white">
                  <div className="flex items-center gap-4">
                    <Building2 className="h-8 w-8 text-cyan-100" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-100">Enterprise Pattern Brief</p>
                      <h2 className="text-2xl font-black">Organization-Wide Flag Analysis</h2>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {isGeneratingOrgReport && orgAgentStatus && !orgReport && (
                    <div className="mb-4 flex items-center gap-3 rounded-xl bg-cyan-50 p-4">
                      <div className="relative h-8 w-8">
                        <div className="absolute inset-0 rounded-full border-2 border-cyan-200" />
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-700 border-t-transparent" />
                      </div>
                      <div>
                        <span className="block text-sm font-semibold text-cyan-800">{orgAgentStatus.agent}</span>
                        <span className="text-sm text-gray-600">{orgAgentStatus.message}</span>
                      </div>
                    </div>
                  )}

                  {orgReport && (
                    <>
                      <div className="rounded-2xl bg-gradient-to-br from-cyan-50 via-white to-teal-50 p-5">
                        <ReactMarkdown components={orgReportComponents}>{orgReport}</ReactMarkdown>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleDownloadOrgReport}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-sm font-bold text-cyan-800 shadow-sm smooth-transition hover:bg-cyan-50"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Report</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.article>
            )}
          </AnimatePresence>

          <div>
            {loading ? (
              <div className="flex justify-center py-12 text-gray-400">Loading flags...</div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
            ) : flags.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center shadow-sm">
                <h3 className="text-lg font-medium text-gray-800">No flags detected</h3>
                <p className="text-gray-500">There are currently no employees matching the flag criteria.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-gray-500">
                        {flags.length} Flagged Employee{flags.length !== 1 && 's'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Analysis timeframe:</span>
                      <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value as 'week' | 'month')}
                        className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:ring-1 focus:ring-primary-400"
                      >
                        <option value="week">Past Week</option>
                        <option value="month">Past Month</option>
                      </select>
                    </div>
                  </div>
                </div>
                {flags.map((emp) => (
                  <FlaggedEmployeeCard key={emp.employee_id} emp={emp} timeframe={timeframe} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default FlagsPage
