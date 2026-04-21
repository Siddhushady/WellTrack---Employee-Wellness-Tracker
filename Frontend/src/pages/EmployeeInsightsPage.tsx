import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown, { type Components } from 'react-markdown'
import { ArrowLeft, BarChart2, CalendarDays, Database, Download, FileText, Send, Sparkles, UserRound } from 'lucide-react'
import EmotionChart from '../components/EmotionChart'
import { adminAPI, type EmployeeEmotionSummary } from '../services/api'

const EMOTIONS = ['happy', 'neutral', 'surprise', 'sad', 'fear', 'angry', 'disgust'] as const
type EmotionKey = (typeof EMOTIONS)[number]

const EMOTION_LABELS: Record<EmotionKey, string> = {
  angry: 'Angry',
  disgust: 'Disgust',
  fear: 'Fear',
  happy: 'Happy',
  neutral: 'Neutral',
  sad: 'Sad',
  surprise: 'Surprise',
}

const EMOTION_COLORS: Record<EmotionKey, string> = {
  angry: '#dc2626',
  disgust: '#f59e0b',
  fear: '#2563eb',
  happy: '#10b981',
  neutral: '#fbbf24',
  sad: '#ef4444',
  surprise: '#a855f7',
}

const emptyEmotionTotals = (): Record<EmotionKey, number> => ({
  angry: 0,
  disgust: 0,
  fear: 0,
  happy: 0,
  neutral: 0,
  sad: 0,
  surprise: 0,
})

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Unavailable'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}-${month}-${year}` : value
}

const reportMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 first:mt-0 text-2xl font-bold text-slate-950 tracking-normal">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 first:mt-0 border-l-4 border-primary-500 pl-3 text-xl font-bold text-slate-900">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 text-base font-semibold uppercase text-slate-700">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[15px] leading-7 text-slate-700">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 pl-8">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="ml-4 text-[15px] leading-7 text-slate-700 marker:text-primary-500">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-950">{children}</strong>
  ),
  hr: () => <div className="my-8 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />,
}

const EmployeeInsightsPage = () => {
  const navigate = useNavigate()
  const reportRef = useRef<HTMLElement>(null)
  const defaultPromptWeek = 'Analyze their emotional trends over the past week. Are they showing signs of burnout? What specific interventions do you recommend based on this data?'
  const defaultPromptMonth = 'Analyze their emotional trends over the past month. Are they showing signs of burnout? What specific interventions do you recommend based on this data?'

  const [employeeId, setEmployeeId] = useState('')
  const [timeframe, setTimeframe] = useState<'week' | 'month'>('month')
  const [prompt, setPrompt] = useState(defaultPromptMonth)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [agentStatus, setAgentStatus] = useState<{ agent: string; status: string; message: string } | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [summary, setSummary] = useState<EmployeeEmotionSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isSendingReport, setIsSendingReport] = useState(false)

  const selectedDays = timeframe === 'week' ? 7 : 30

  const handleTimeframeChange = (newTimeframe: 'week' | 'month') => {
    setTimeframe(newTimeframe)
    if (prompt === defaultPromptWeek || prompt === defaultPromptMonth) {
      setPrompt(newTimeframe === 'week' ? defaultPromptWeek : defaultPromptMonth)
    }
  }

  const emotionTotals = useMemo(() => {
    const base = emptyEmotionTotals()

    summary?.emotions.forEach(emotion => {
      const emotionKey = emotion.status.trim().toLowerCase()
      if (EMOTIONS.includes(emotionKey as EmotionKey)) {
        base[emotionKey as EmotionKey] += Number(emotion.total) || 0
      }
    })

    return base
  }, [summary])

  const totalDetections = Object.values(emotionTotals).reduce((sum, count) => sum + count, 0)
  const dominantEmotion = totalDetections > 0 ? EMOTIONS.reduce((best, emotion) => (
    emotionTotals[emotion] > emotionTotals[best] ? emotion : best
  ), EMOTIONS[0]) : null
  const positiveCount = emotionTotals.happy + emotionTotals.neutral + emotionTotals.surprise
  const strainCount = emotionTotals.angry + emotionTotals.disgust + emotionTotals.fear + emotionTotals.sad
  const positiveRatio = totalDetections > 0 ? (positiveCount / totalDetections) * 100 : 0
  const strainRatio = totalDetections > 0 ? (strainCount / totalDetections) * 100 : 0
  const reportEmployeeId = summary?.employee_id || employeeId.trim().toUpperCase() || 'Employee'
  const reportDepartment = summary?.department || 'Unavailable in DB'
  const reportRange = summary
    ? `${formatDate(summary.start_date)} to ${formatDate(summary.end_date)}`
    : `Selected ${selectedDays}-day range unavailable in DB summary`

  const dbNotice = summaryError
    || (summary && totalDetections === 0
      ? `No emotion rows were returned from the database for ${reportEmployeeId} in this ${selectedDays}-day range.`
      : null)

  const emotionBars = EMOTIONS.map(emotion => {
    const count = emotionTotals[emotion]
    return {
      emotion,
      count,
      percentage: totalDetections > 0 ? (count / totalDetections) * 100 : 0,
    }
  }).filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count)

  const handleDownloadPdf = () => {
    if (!reportRef.current) return

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
    const reportHtml = reportRef.current.outerHTML
    const safeFileName = `${reportEmployeeId}-emotion-analysis-report`

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${safeFileName}</title>
          ${styles}
          <style>
            @page {
              size: A4;
              margin: 14mm;
            }

            html,
            body {
              background: #ffffff !important;
              margin: 0;
              min-height: 100%;
              font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            #employee-analysis-report {
              border-radius: 0 !important;
              box-shadow: none !important;
              border: 1px solid #e2e8f0 !important;
              overflow: visible !important;
              width: 100% !important;
            }

            #employee-analysis-report section,
            #employee-analysis-report .rounded-2xl,
            #employee-analysis-report .employee-report-markdown h1,
            #employee-analysis-report .employee-report-markdown h2,
            #employee-analysis-report .employee-report-markdown h3,
            #employee-analysis-report .employee-report-markdown ul,
            #employee-analysis-report .employee-report-markdown ol {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            #employee-analysis-report svg {
              max-height: 230px;
            }

            * {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          </style>
        </head>
        <body>${reportHtml}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  const handleSendReport = async () => {
    if (!result || !summary) {
      setSendStatus({
        type: 'error',
        message: 'Cannot send yet. Database summary is required for the employee copy.',
      })
      return
    }

    try {
      setIsSendingReport(true)
      setSendStatus(null)
      const sent = await adminAPI.sendEmployeeReport({
        employee_id: summary.employee_id,
        timeframe,
        report_content: result,
        report_summary: summary,
        report_type: 'insight',
      })
      setSendStatus({
        type: 'success',
        message: `Report sent to ${sent.employee_id} at ${new Date(sent.sent_at).toLocaleString()}.`,
      })
    } catch (err) {
      console.error('Failed to send employee report:', err)
      setSendStatus({
        type: 'error',
        message: 'Unable to send report copy. Please confirm the backend and database are running.',
      })
    } finally {
      setIsSendingReport(false)
    }
  }

  const handleAnalyze = async () => {
    const trimmedEmployeeId = employeeId.trim()
    if (!trimmedEmployeeId || !prompt.trim()) return

    setIsAnalyzing(true)
    setAgentStatus(null)
    setResult(null)
    setSummary(null)
    setSummaryError(null)
    setError(null)
    setSendStatus(null)

    adminAPI.getEmployeeEmotionSummary(trimmedEmployeeId, timeframe)
      .then(data => {
        setSummary(data)
        setSummaryError(null)
      })
      .catch(err => {
        console.error('Failed to fetch employee emotion summary:', err)
        setSummaryError('DB summary unavailable for this employee/timeframe.')
      })

    const url = new URL(`${import.meta.env?.VITE_API_URL || 'http://localhost:8000'}/analyze/employee/stream`)
    url.searchParams.append('employee_id', trimmedEmployeeId)
    url.searchParams.append('prompt', prompt)
    url.searchParams.append('timeframe', timeframe)

    const eventSource = new EventSource(url.toString())

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.status === 'summary' && data.summary && !data.summary.error) {
          setSummary(data.summary)
          setSummaryError(null)
        } else if (data.status === 'complete') {
          if (data.summary && !data.summary.error) {
            setSummary(data.summary)
            setSummaryError(null)
          } else if (data.summary?.error) {
            setSummaryError(data.summary.error)
          }
          setResult(data.result)
          setIsAnalyzing(false)
          eventSource.close()
        } else if (data.status === 'error') {
          setError(data.message)
          setIsAnalyzing(false)
          eventSource.close()
        } else {
          setAgentStatus({
            agent: data.agent,
            status: data.status,
            message: data.message,
          })
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

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="glass-effect border-b border-white/20 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 smooth-transition font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Deep Employee Analysis</h1>
              <p className="text-sm text-gray-600">Multi-agent AI analysis of individual emotional histories</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 space-y-6 no-print"
          >
            <div className="glass-effect rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-600" />
                Analysis Parameters
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. EMP001"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    disabled={isAnalyzing}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
                  <select
                    value={timeframe}
                    onChange={(e) => handleTimeframeChange(e.target.value as 'week' | 'month')}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    disabled={isAnalyzing}
                  >
                    <option value="week">Past Week (7 Days)</option>
                    <option value="month">Past Month (30 Days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Analysis Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm resize-none"
                    disabled={isAnalyzing}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Instruct the Analysis Agent on what specifically to look for in the data.
                  </p>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !employeeId.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isAnalyzing ? 'Analyzing...' : 'Generate Insights'}</span>
                </button>
              </div>
            </div>

            {(isAnalyzing || agentStatus) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-effect rounded-2xl p-6 border-l-4 border-indigo-500"
              >
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  Multi-Agent Activity Log
                </h3>

                {agentStatus && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                        {agentStatus.agent}
                      </span>
                      {agentStatus.status === 'working' ? (
                        <span className="text-amber-500 text-xs font-semibold">[Working...]</span>
                      ) : agentStatus.status === 'done' ? (
                        <span className="text-green-500 text-xs font-semibold">[Done]</span>
                      ) : (
                        <span className="text-red-500 text-xs font-semibold">[Error]</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 pl-1">{agentStatus.message}</p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="glass-effect rounded-2xl p-6 min-h-[500px]">
              {error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
                  <p className="font-semibold">Error:</p>
                  <p>{error}</p>
                </div>
              ) : result ? (
                <div className="space-y-5">
                  <article
                    id="employee-analysis-report"
                    ref={reportRef}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70"
                  >
                    <div className="bg-slate-950 px-6 py-7 text-white sm:px-8">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase text-cyan-100">
                            <FileText className="w-3.5 h-3.5" />
                            Employee Wellness Intelligence
                          </div>
                          <h2 className="text-3xl font-bold tracking-normal sm:text-4xl">
                            Emotion Analysis Report
                          </h2>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                            AI-generated analysis presented with employee-level emotional distribution from the database.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                          <div className="rounded-xl bg-white/10 p-3">
                            <p className="text-xs uppercase text-slate-400">Employee</p>
                            <p className="mt-1 font-bold text-white">{reportEmployeeId}</p>
                          </div>
                          <div className="rounded-xl bg-white/10 p-3">
                            <p className="text-xs uppercase text-slate-400">Department</p>
                            <p className="mt-1 font-bold text-white">{reportDepartment}</p>
                          </div>
                          <div className="rounded-xl bg-white/10 p-3">
                            <p className="text-xs uppercase text-slate-400">Data Range</p>
                            <p className="mt-1 font-bold text-white">{reportRange}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 p-6 sm:p-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <BarChart2 className="h-5 w-5 text-primary-600" />
                            <h3 className="font-bold text-slate-900">Emotional Distribution</h3>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {totalDetections} detections
                          </span>
                        </div>
                        {dbNotice && (
                          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                            <Database className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{dbNotice}</span>
                          </div>
                        )}
                        <EmotionChart stats={emotionTotals} />
                      </section>

                      <section className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                            <p className="text-xs font-semibold uppercase text-emerald-700">Positive Mix</p>
                            <p className="mt-2 text-3xl font-bold text-emerald-700">{positiveRatio.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                            <p className="text-xs font-semibold uppercase text-rose-700">Strain Signals</p>
                            <p className="mt-2 text-3xl font-bold text-rose-700">{strainRatio.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                            <p className="text-xs font-semibold uppercase text-amber-700">Dominant</p>
                            <p className="mt-2 text-3xl font-bold text-amber-700">
                              {dominantEmotion ? EMOTION_LABELS[dominantEmotion] : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="mb-4 flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-primary-600" />
                            <h3 className="font-bold text-slate-900">Top Emotion Contributors</h3>
                          </div>
                          {emotionBars.length > 0 ? (
                            <div className="space-y-3">
                              {emotionBars.map(({ emotion, count, percentage }) => (
                                <div key={emotion}>
                                  <div className="mb-1 flex items-center justify-between text-sm">
                                    <span className="font-semibold text-slate-700">{EMOTION_LABELS[emotion]}</span>
                                    <span className="text-slate-500">{count} ({percentage.toFixed(1)}%)</span>
                                  </div>
                                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${percentage}%`, backgroundColor: EMOTION_COLORS[emotion] }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex min-h-44 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
                              No emotion distribution data available in the database for this employee and timeframe.
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="border-t border-slate-200 bg-white p-6 sm:p-8">
                      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
                          <UserRound className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">Generated Insights</h3>
                          <p className="text-sm text-slate-600">
                            The following content is the original analysis generated by the agent.
                          </p>
                        </div>
                      </div>
                      <div className="employee-report-markdown">
                        <ReactMarkdown components={reportMarkdownComponents}>{result}</ReactMarkdown>
                      </div>
                    </div>
                  </article>

                  <div className="flex flex-col items-center gap-3 no-print">
                    {sendStatus && (
                      <div className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                        sendStatus.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}>
                        {sendStatus.message}
                      </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={handleDownloadPdf}
                      className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-5 py-3 text-sm font-semibold text-primary-700 shadow-lg shadow-primary-100/60 smooth-transition hover:border-primary-300 hover:bg-primary-50 hover:shadow-xl"
                    >
                      <Download className="h-5 w-5" />
                      <span>Download Report as PDF</span>
                    </button>
                    <button
                      onClick={handleSendReport}
                      disabled={isSendingReport || !summary}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-100/60 smooth-transition hover:bg-emerald-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-5 w-5" />
                      <span>{isSendingReport ? 'Sending...' : 'Send Copy to Employee'}</span>
                    </button>
                    </div>
                  </div>
                </div>
              ) : isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-primary-200 rounded-full" />
                    <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin" />
                  </div>
                  <p>Agents are actively reasoning over the data...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <p>Enter an Employee ID and click Generate Insights to begin.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export default EmployeeInsightsPage
