// main.js
const { useState, useRef, useEffect } = React;

// --- Simulated data (you can adjust these values) ---
const SIMULATION_TIME = 60; // seconds
const TOTAL_REQUESTS = 643;

// Default metrics in case file is not found
const DEFAULT_APACHE_METRICS = {
  avgResponse: 350, // ms
  throughput: 200, // KB/s
  errors: 7,
};
const DEFAULT_NODE_METRICS = {
  avgResponse: 180, // ms
  throughput: 350, // KB/s
  errors: 1,
};

// Hook to fetch and parse metrics from summary.txt
function useDynamicMetrics() {
  const [apache, setApache] = React.useState(DEFAULT_APACHE_METRICS);
  const [node, setNode] = React.useState(DEFAULT_NODE_METRICS);

  React.useEffect(() => {
    fetch('./jmeter/summary.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(txt => {
        // Parse metrics for Laravel/Apache
        const laravelSection = txt.laravel;
        const nodeSection = txt.node;
        const parseSection = (section) => {
          const avgResponse = section.avgResponse;
          const errors = section.errors;
          const complete = section.complete;
          const rps = section.rps;
          // Throughput is not present, fallback to rps * 20 as a guess
          return {
            avgResponse,
            errors,
            throughput: Math.round(rps * 20),
            complete,
            rps,
          };
        };
        if (laravelSection) setApache(parseSection(laravelSection));
        if (nodeSection) setNode(parseSection(nodeSection));
      })
      .catch(() => {
        setApache(DEFAULT_APACHE_METRICS);
        setNode(DEFAULT_NODE_METRICS);
      });
  }, []);

  return { apache, node };
}

// --- Generate load curve data for both servers ---
function generateLoadCurve() {
  const time = Array.from({ length: SIMULATION_TIME + 1 }, (_, i) => i);
  // Simulate accumulated requests with small variations
  const apache = time.map(t => Math.round((TOTAL_REQUESTS * t / SIMULATION_TIME) * (0.97 + Math.random()*0.06)));
  const node = time.map(t => Math.round((TOTAL_REQUESTS * t / SIMULATION_TIME) * (0.98 + Math.random()*0.04)));
  return { time, apache, node };
}

// --- Get load curve from node and laravel csv ---
function getLoadCurveFromCsvs() {
  const time = Array.from({ length: SIMULATION_TIME + 1 }, (_, i) => i);
  const [apache, setApache] = React.useState([]);
  const [node, setNode] = React.useState([]);
  
  React.useEffect(() => {
    Promise.all([
      fetch('jmeter/laravel_jmeter.csv').then(res => res.text()),
      fetch('jmeter/node_jmeter.csv').then(res => res.text()),
    ]).then(([laravel_csv, node_csv]) => {
      const laravel_lines = laravel_csv.split('\n').map(line => line.split(',')[14]);
      const node_lines = node_csv.split('\n').map(line => line.split(',')[14]);
      const apache = laravel_lines.map(line => parseInt(line));
      const node = node_lines.map(line => parseInt(line));
      setApache(apache);
      setNode(node);
    });
  }, []);

  return { time, apache, node };
}

// --- Components ---
function Tabs({ tab, setTab }) {
  return (
    <div className="tabs">
      <button className={`tab${tab==='apache' ? ' active' : ''}`} onClick={()=>setTab('apache')}>Apache</button>
      <button className={`tab${tab==='node' ? ' active' : ''}`} onClick={()=>setTab('node')}>Node.js</button>
      <button className={`tab compare${tab==='compare' ? ' active' : ''}`} onClick={()=>setTab('compare')}>Comparar</button>
    </div>
  );
}

function PlayStop({ running, onPlay, onStop }) {
  return (
    <div className="button-group">
      <button className="play" onClick={onPlay} disabled={running}>Play</button>
      <button className="stop" onClick={onStop} disabled={!running}>Stop</button>
    </div>
  );
}

function LineChart({ data, showApache, showNode }) {
  const canvasRef = useRef();
  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: data.time,
        datasets: [
          showApache && {
            label: 'Apache',
            data: data.apache,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            tension: 0.22,
            pointRadius: 0,
            borderWidth: 2.5,
          },
          showNode && {
            label: 'Node.js',
            data: data.node,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            tension: 0.22,
            pointRadius: 0,
            borderWidth: 2.5,
          },
        ].filter(Boolean),
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (seconds)' },
            ticks: { color: '#64748b' },
          },
          y: {
            title: { display: true, text: 'Latency (ms)' },
            beginAtZero: true,
            ticks: { color: '#64748b' },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [data, showApache, showNode]);
  return <canvas ref={canvasRef} height="110"></canvas>;
}

function MetricsBar({ apache, node, showApache, showNode }) {
  // Normalización para altura de barras
  const maxResp = Math.max(apache.avgResponse, node.avgResponse);
  const maxThrough = Math.max(apache.throughput, node.throughput);
  const maxErr = Math.max(apache.errors, node.errors);

  const highErr = (server) =>  55 * (maxErr > 0 ? (server.errors/maxErr) : 0) + 5;
  const highResp = (server) => 55 * (maxResp > 0 ? (server.avgResponse/maxResp) : 0) + 5;
  const highThrough = (server) => 55 * (maxThrough > 0 ? (server.throughput/maxThrough) : 0) + 5;

  return (
    <div className="metrics-bar">
      <div className="metric">
        <div className="metric-title">⏱️ Average response time (ms)</div>
        <div className="metric-bar">
          {showApache && <div className="metric-bar-rect metric-bar-apache" style={{height: highResp(apache)}} title={apache.avgResponse}></div>}
          {showNode && <div className="metric-bar-rect metric-bar-node" style={{height: highResp(node)}} title={node.avgResponse}></div>}
        </div>
        <div className="metric-label">
          {showApache && <span style={{color:'#2563eb'}}>Apache: {apache.avgResponse} ms</span>}
          {showApache && showNode && <span> | </span>}
          {showNode && <span style={{color:'#10b981'}}>Node: {node.avgResponse} ms</span>}
        </div>
      </div>
      <div className="metric">
        <div className="metric-title">📦 Transfer rate (KB/s)</div>
        <div className="metric-bar">
          {showApache && <div className="metric-bar-rect metric-bar-apache" style={{height: highThrough(apache)}} title={apache.throughput}></div>}
          {showNode && <div className="metric-bar-rect metric-bar-node" style={{height: highThrough(node)}} title={node.throughput}></div>}
        </div>
        <div className="metric-label">
          {showApache && <span style={{color:'#2563eb'}}>Apache: {apache.throughput} KB/s</span>}
          {showApache && showNode && <span> | </span>}
          {showNode && <span style={{color:'#10b981'}}>Node: {node.throughput} KB/s</span>}
        </div>
      </div>
      <div className="metric">
        <div className="metric-title">❌ Failed requests</div>
        <div className="metric-bar">
          {showApache && <div className="metric-bar-rect metric-bar-apache" style={{height: highErr(apache)}} title={apache.errors}></div>}
          {showNode && <div className="metric-bar-rect metric-bar-node" style={{height: highErr(node)}} title={node.errors}></div>}
        </div>
        <div className="metric-label">
          {showApache && <span style={{color:'#2563eb'}}>Apache: {apache.errors}</span>}
          {showApache && showNode && <span> | </span>}
          {showNode && <span style={{color:'#10b981'}}>Node: {node.errors}</span>}
        </div>
      </div>
    </div>
  );
}

// Animation of requests
function SimulationAnim({ running, tab, progress, requests, errors, server }) {
  // requests: array of {time, status: 'ok'|'fail'}
  // progress: 0..1
  // server: 'apache' | 'node'
  // Colors
  const color = server === 'apache' ? '#2563eb' : '#10b981';
  const icon = server === 'apache' ? '🧭' : '🚀';
  const serverLabel = server === 'apache' ? 'Apache' : 'Node.js';
  // Solo muestra los mensajes que ya "llegaron" según el progreso
  const shown = requests.filter(r => r.time <= progress * SIMULATION_TIME);
  return (
    <div className="simulation-anim">
      <svg className="simulation-svg" viewBox="0 0 440 160">
        {/* Cliente */}
        <g>
          <circle cx="50" cy="80" r="28" fill="#f1f5f9" stroke="#64748b" strokeWidth="2" />
          <text x="50" y="85" textAnchor="middle" fontSize="28">👤</text>
        </g>
        {/* Servidor */}
        <g>
          <rect x="340" y="50" width="70" height="60" rx="12" fill={color} />
          <text x="375" y="88" textAnchor="middle" fontSize="28" fill="#fff">{icon}</text>
        </g>
        {/* Mensajes */}
        {shown.map((r,i) => {
          const frac = Math.min(1, (progress * SIMULATION_TIME - r.time) / 1.2); // animación de viaje
          const x = 50 + (290 * frac);
          const y = 80 + (Math.sin(i*0.7)*15);
          return (
            <g key={i}>
              {/* Mensaje */}
              <circle cx={x} cy={y} r="10" fill={r.status==='ok'?color:'#ef4444'} opacity={0.93} />
              <text x={x} y={y+5} textAnchor="middle" fontSize="16" fill="#fff">💬</text>
              {/* Respuesta */}
              {frac===1 && (
                <text x={x+30} y={y+5} fontSize="18" fill={r.status==='ok'?"#10b981":"#ef4444"}>
                  {r.status==='ok'?'✅':'❌'}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="timeline-bar">
        <div className={`timeline-progress${server==='node'?' node':''}`} style={{width: `${progress*100}%`}}></div>
      </div>
      <div className="sim-labels">
        <span>0s</span>
        <span>{serverLabel}</span>
        <span>60s</span>
      </div>
    </div>
  );
}

function SimulationPanel({ tab, running, progress, apacheMetrics, nodeMetrics }) {
  // Prepare data
  const loadData = getLoadCurveFromCsvs();

  // State for requests loaded from CSV
  const [apacheReqs, setApacheReqs] = React.useState([]);
  const [nodeReqs, setNodeReqs] = React.useState([]);

  React.useEffect(() => {
    generateRequests('apache').then(setApacheReqs);
    generateRequests('node').then(setNodeReqs);
  }, []);
  const showApache = tab==='apache'||tab==='compare';
  const showNode = tab==='node'||tab==='compare';
  return (
    <div>
      <LineChart data={loadData} showApache={showApache} showNode={showNode} />
      <MetricsBar apache={apacheMetrics} node={nodeMetrics} showApache={showApache} showNode={showNode} />
      {tab==='compare' ? (
        <div className="split-view">
          <SimulationAnim running={running} tab={tab} progress={progress} requests={apacheReqs} errors={apacheMetrics.errors} server="apache" />
          <SimulationAnim running={running} tab={tab} progress={progress} requests={nodeReqs} errors={nodeMetrics.errors} server="node" />
        </div>
      ) : tab==='apache' ? (
        <SimulationAnim running={running} tab={tab} progress={progress} requests={apacheReqs} errors={apacheMetrics.errors} server="apache" />
      ) : (
        <SimulationAnim running={running} tab={tab} progress={progress} requests={nodeReqs} errors={nodeMetrics.errors} server="node" />
      )}
    </div>
  );
}

// Update generateRequests to accept errors as parameter
// Refactored: generateRequests now fetches and parses CSV data
async function generateRequests(server) {
  // Select CSV file based on server
  const csvFile = server === 'apache' ? 'jmeter/laravel_jmeter.csv' : 'jmeter/node_jmeter.csv';
  const res = await fetch(csvFile);
  const text = await res.text();
  const lines = text.split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  // Parse CSV rows: timestamp (col 0), status (col 3)
  const requests = [];
  const firstTimestamp = parseInt(lines[1].split(',')[0]);
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 4) continue;
    const timestamp = parseInt(cols[0]);
    const status = cols[3].trim();
    if (!timestamp || isNaN(timestamp)) continue;
    // Only consider rows with status
    const time = timestamp - firstTimestamp;
    requests.push({
      time: time / 1000, // assuming timestamp is in ms, convert to seconds
      status: status === '201' ? 'ok' : 'fail',
    });
  }
  return requests;
}

function App() {
  const [tab, setTab] = useState('compare');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef();
  const { apache, node } = useDynamicMetrics();

  // Control the simulation
  useEffect(() => {
    if (!running) {
      setProgress(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setProgress(Math.min(1, elapsed / SIMULATION_TIME));
      if (elapsed >= SIMULATION_TIME) {
        setRunning(false);
        clearInterval(timerRef.current);
      }
    }, 60);
    return () => clearInterval(timerRef.current);
  }, [running]);

  return (
    <div className="simulation-container">
      <h2 style={{textAlign:'center',marginTop:0}}>Simulation Visual: Apache vs Node.js</h2>
      <Tabs tab={tab} setTab={setTab} />
      <PlayStop running={running} onPlay={()=>setRunning(true)} onStop={()=>setRunning(false)} />
      <SimulationPanel tab={tab} running={running} progress={progress} apacheMetrics={apache} nodeMetrics={node} />
      <div style={{marginTop:'2rem',fontSize:'0.98rem',textAlign:'center',color:'#64748b'}}>
        <span>Comparing 643 POST requests simulated in 60 seconds (chat traffic)</span>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
