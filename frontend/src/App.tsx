import { useEffect, useRef, useState } from 'react'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const websocketBaseUrl = apiBaseUrl.replace(/^http/, 'ws')

type CallStatus = 'idle' | 'connecting' | 'live' | 'ended' | 'error'
type Transcript = { id: string; text: string; time: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>(
    'checking',
  )
  const [transcriptionMode, setTranscriptionMode] = useState<'mock' | 'gnani' | null>(
    null,
  )
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBaseUrl}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed')
        return response.json()
      })
      .then((payload: unknown) => {
        if (
          !isRecord(payload) ||
          (payload.transcription_mode !== 'mock' &&
            payload.transcription_mode !== 'gnani')
        ) {
          throw new Error('Invalid health response')
        }
        setTranscriptionMode(payload.transcription_mode)
        setApiStatus('online')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setApiStatus('offline')
      })

    return () => {
      controller.abort()
      socketRef.current?.close()
    }
  }, [])

  function startDemo() {
    if (transcriptionMode !== 'mock' || apiStatus !== 'online') return
    setTranscripts([])
    setCallStatus('connecting')
    const socket = new WebSocket(`${websocketBaseUrl}/ws/calls/demo`)
    socketRef.current = socket

    socket.onopen = () => {
      setCallStatus('live')
      socket.send(JSON.stringify({ type: 'demo' }))
    }

    socket.onmessage = (event: MessageEvent<string>) => {
      const payload: unknown = JSON.parse(event.data)
      if (!isRecord(payload) || typeof payload.type !== 'string') return

      if (
        payload.type === 'transcript' &&
        typeof payload.text === 'string'
      ) {
        const text = payload.text
        setTranscripts((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            text,
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ])
      } else if (
        payload.type === 'error' &&
        typeof payload.message === 'string'
      ) {
        setCallStatus('error')
      }
    }

    socket.onerror = () => setCallStatus('error')
    socket.onclose = () => {
      socketRef.current = null
      setCallStatus((current) => (current === 'error' ? 'error' : 'ended'))
    }
  }

  function endDemo() {
    const socket = socketRef.current
    socketRef.current = null
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'end' }))
    }
    socket?.close()
    setCallStatus('ended')
  }

  const isLive = callStatus === 'live' || callStatus === 'connecting'

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <a className="flex items-center gap-3 px-2" href="/" aria-label="Kiara Calls home">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            K
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-tight">kiara</span>
            <span className="block text-xs text-slate-500">CALLS · COACHING</span>
          </span>
        </a>

        <div className="mt-12 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </div>
        <nav className="mt-3 space-y-1">
          <a className="flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-700" href="#overview">
            <span aria-hidden="true">◫</span> Overview
          </a>
          <a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50" href="#live-call">
            <span aria-hidden="true">◉</span> Live calls
          </a>
          <a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50" href="#coaching">
            <span aria-hidden="true">✦</span> Coaching
          </a>
        </nav>

        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              className={`size-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : apiStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-400'}`}
            />
            Backend {apiStatus}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {apiStatus === 'online'
              ? 'Ready for a coaching session.'
              : apiStatus === 'offline'
                ? 'Start the API to connect to call sessions.'
                : 'Checking the API connection…'}
          </p>
        </div>
      </aside>

      <main className="lg:ml-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="text-sm text-slate-500">Workspace <span className="mx-2">/</span> <span className="font-medium text-slate-900">Overview</span></div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">Enterprise workspace</span>
            <span className="grid size-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">AK</span>
          </div>
        </header>

        <div id="overview" className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-indigo-600">Thursday, November 5</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Good morning, Ayush</h1>
              <p className="mt-2 text-slate-500">Here’s your contact centre at a glance.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <span className="size-2 rounded-full bg-emerald-500" />
              All systems operational
            </div>
          </div>

          <section aria-label="Team metrics" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Calls today', value: '128', note: '+12% vs yesterday', mark: '↗' },
              { label: 'Avg. call quality', value: '92%', note: '+4.2% this week', mark: '✦' },
              { label: 'Coaching moments', value: '18', note: 'Across 6 agents', mark: '◎' },
              { label: 'Active agents', value: '24', note: '3 teams online', mark: '◉' },
            ].map((metric) => (
              <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  {metric.label}
                  <span className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">{metric.mark}</span>
                </div>
                <div className="mt-4 text-3xl font-semibold tracking-tight">{metric.value}</div>
                <div className="mt-2 text-xs text-slate-500">{metric.note}</div>
              </article>
            ))}
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article id="live-call" className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="font-semibold">Live call workspace</h2>
                  <p className="mt-1 text-sm text-slate-500">Real-time Hinglish transcription preview</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isLive ? 'bg-emerald-50 text-emerald-700' : callStatus === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                  <span className="mr-1.5">●</span>
                  {callStatus === 'connecting' ? 'Connecting' : callStatus === 'live' ? 'Session live' : callStatus === 'error' ? 'Connection issue' : callStatus === 'ended' ? 'Session ended' : 'Ready'}
                </span>
              </div>

              <div className="min-h-64 space-y-4 p-5 sm:p-6">
                {transcripts.length === 0 ? (
                  <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                    <div>
                      <div className="mx-auto grid size-11 place-items-center rounded-full bg-indigo-50 text-xl text-indigo-600">◉</div>
                      <p className="mt-3 font-medium text-slate-700">Your call transcript will appear here</p>
                      <p className="mt-1 text-sm text-slate-500">Start a mock session to preview the coaching workspace.</p>
                    </div>
                  </div>
                ) : (
                  transcripts.map((transcript) => (
                    <div key={transcript.id} className="flex gap-3">
                      <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">AG</span>
                      <div className="rounded-xl rounded-tl-sm bg-slate-100 px-4 py-3">
                        <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">Agent</span>
                          <span>{transcript.time}</span>
                        </div>
                        <p className="text-sm leading-6">{transcript.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
                <span className="text-xs text-slate-500">
                  {transcriptionMode === 'mock'
                    ? 'Mock mode · No microphone audio is sent'
                    : 'Live mode · Microphone audio capture is not included'}
                </span>
                {isLive ? (
                  <button onClick={endDemo} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    End session
                  </button>
                ) : (
                  <button
                    onClick={startDemo}
                    disabled={apiStatus !== 'online' || transcriptionMode !== 'mock'}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {apiStatus === 'checking'
                      ? 'Checking backend…'
                      : apiStatus === 'offline'
                        ? 'Backend unavailable'
                        : transcriptionMode === 'gnani'
                          ? 'Live audio UI coming soon'
                          : 'Start mock session'}
                  </button>
                )}
              </div>
            </article>

            <article id="coaching" className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="font-semibold">Coaching focus</h2>
                <p className="mt-1 text-sm text-slate-500">Your team’s focus areas</p>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                {[
                  { label: 'Active listening', percent: 84, color: 'bg-indigo-500' },
                  { label: 'Clear resolution', percent: 72, color: 'bg-violet-500' },
                  { label: 'Empathy & rapport', percent: 91, color: 'bg-emerald-500' },
                ].map((focus) => (
                  <div key={focus.label}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-slate-700">{focus.label}</span>
                      <span className="font-medium text-slate-900">{focus.percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${focus.color}`} style={{ width: `${focus.percent}%` }} />
                    </div>
                  </div>
                ))}
                <div className="rounded-lg bg-indigo-50 p-4 text-sm leading-6 text-indigo-900">
                  <span className="font-semibold">Next up</span>
                  <p className="mt-1 text-indigo-800">Call insights and coaching recommendations will be available as monitoring features are added.</p>
                </div>
              </div>
            </article>
          </section>

          <footer className="mt-8 text-center text-xs text-slate-400">
            Kiara Calls · Coaching that makes every conversation count
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
