import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { adminAPI, FlaggedEmployee } from '../services/api'


// Subcomponent for individual employee analysis
const FlaggedEmployeeCard = ({ emp, timeframe }: { emp: FlaggedEmployee, timeframe: 'week' | 'month' }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [agentStatus, setAgentStatus] = useState<{ agent: string; status: string; message: string } | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = () => {
    if (isAnalyzing || result) return

    setIsAnalyzing(true)
    setAgentStatus(null)
    setResult(null)
    setError(null)

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden mb-4">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-red-50/50 smooth-transition"
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
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
          {isExpanded ? <span className="text-gray-400 text-xl font-bold">−</span> : <span className="text-gray-400 text-xl font-bold">+</span>}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-red-50 bg-slate-50/50"
          >
            <div className="p-6">
              {(isAnalyzing || agentStatus) && !result && (
                <div className="mb-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    Agent Status
                  </h4>
                  {agentStatus && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded text-xs">
                        {agentStatus.agent}
                      </span>
                      {agentStatus.status === 'working' ? (
                        <span className="text-amber-500 text-xs font-semibold">[Working...]</span>
                      ) : (
                        <span className="text-green-500 text-xs font-semibold">[Done]</span>
                      )}
                      <span className="text-gray-600 text-xs">{agentStatus.message}</span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2 mb-4">
                  <p className="font-bold">Error:</p>
                  <p>{error}</p>
                </div>
              )}

              {result && (
                <div className="prose prose-sm prose-indigo max-w-none text-gray-700 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <ReactMarkdown>{result}</ReactMarkdown>
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-lg smooth-transition">
              <span className="text-gray-600 font-medium">← Back</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                Employee Flags
              </h1>
              <p className="text-sm text-gray-500">Review employees showing concerning emotional trends</p>
            </div>
          </div>
          
          <button
            onClick={handleGenerateOrgReport}
            disabled={isGeneratingOrgReport || flags.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >

            {isGeneratingOrgReport ? 'Generating...' : 'Org-Wide Report'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Org-Wide Report Section */}
        <AnimatePresence>
          {(isGeneratingOrgReport || orgReport) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden"
            >
              <div className="p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Organization-Wide Flag Analysis</h2>
                
                {isGeneratingOrgReport && orgAgentStatus && !orgReport && (
                  <div className="mb-4 p-4 bg-indigo-50/50 rounded-lg flex items-center gap-3">
                    <div className="relative w-8 h-8">
                      <div className="absolute inset-0 border-2 border-indigo-200 rounded-full"></div>
                      <div className="absolute inset-0 border-2 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-700 text-sm block">{orgAgentStatus.agent}</span>
                      <span className="text-gray-600 text-sm">{orgAgentStatus.message}</span>
                    </div>
                  </div>
                )}

                {orgReport && (
                  <div className="prose prose-indigo max-w-none text-gray-700">
                    <ReactMarkdown>{orgReport}</ReactMarkdown>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List of Flags */}
        <div>
          {loading ? (
            <div className="flex justify-center py-12 text-gray-400">Loading flags...</div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
          ) : flags.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">

              <h3 className="text-lg font-medium text-gray-800">No flags detected</h3>
              <p className="text-gray-500">There are currently no employees matching the flag criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2 mb-2">
                <span className="text-sm font-medium text-gray-500">
                  {flags.length} Flagged Employee{flags.length !== 1 && 's'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Analysis timeframe:</span>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value as 'week' | 'month')}
                    className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-primary-400"
                  >
                    <option value="week">Past Week</option>
                    <option value="month">Past Month</option>
                  </select>
                </div>
              </div>
              {flags.map((emp) => (
                <FlaggedEmployeeCard key={emp.employee_id} emp={emp} timeframe={timeframe} />
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

export default FlagsPage
