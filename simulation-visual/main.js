// main.js
const { useState, useRef, useEffect } = React;

// --- Simulated data (you can adjust these values) ---
const SIMULATION_TIME = 60; // seconds
const TOTAL_REQUESTS = 643;
const CONCURRENCY = 1;

// Default metrics in case file is not found
const DEFAULT_APACHE_METRICS = {
  avgResponse: 350, // ms
  throughput: 200, // KB/s
  errors: 7,
  timeTaken: 60,
};
const DEFAULT_NODE_METRICS = {
  avgResponse: 180, // ms
  throughput: 350, // KB/s
  errors: 1,
  timeTaken: 60,
};

// Hook to fetch and parse metrics from summary.txt
// Always use a stable dependency array in useEffect. loadTestingTool should always be a string.
function useDynamicMetrics(loadTestingTool = 'jmeter') {
  const [apache, setApache] = React.useState(DEFAULT_APACHE_METRICS);
  const [node, setNode] = React.useState(DEFAULT_NODE_METRICS);

  React.useEffect(() => {
    fetch(`./${loadTestingTool}/summary.json`)
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
          const timeTaken = section.timeTaken;
          // Throughput is not present, fallback to rps * 20 as a guess
          return {
            avgResponse,
            errors,
            throughput: Math.round(rps * 20),
            complete,
            rps,
            timeTaken,
          };
        };
        if (laravelSection) setApache(parseSection(laravelSection));
        if (nodeSection) setNode(parseSection(nodeSection));
      })
      .catch(() => {
        setApache(DEFAULT_APACHE_METRICS);
        setNode(DEFAULT_NODE_METRICS);
      });
  }, [loadTestingTool]); // FIX: Always use a stable dependency array

  return { apache, node };
}

// --- Get load curve from node and laravel csv ---
// JMeterLoadCurve: render-props pattern for jmeter data
function JMeterLoadCurve({ children, loadTestingTool }) {
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
  }, [loadTestingTool]);

  return children({ time, apache, node });
}

// AbLoadCurve: render-props pattern for ab fake data
function AbLoadCurve({ children, loadTestingTool }) {
  const time = Array.from({ length: SIMULATION_TIME + 1 }, (_, i) => i);
  const [apache, setApache] = React.useState([]);
  const [node, setNode] = React.useState([]);

  React.useEffect(() => {
    Promise.all([
      fetch('ab/laravel_ab_simple.csv').then(res => res.text()),
      fetch('ab/node_ab_simple.csv').then(res => res.text()),
    ]).then(([laravel_csv, node_csv]) => {
      const laravel_lines = laravel_csv.split('\n').map(line => line.split(',')[1]);
      const node_lines = node_csv.split('\n').map(line => line.split(',')[1]);
      const apache = laravel_lines.map(line => parseInt(line));
      const node = node_lines.map(line => parseInt(line));
      setApache(apache);
      setNode(node);
    });
  }, [loadTestingTool]);

  return children({ time, apache, node });
}


// --- Components ---
// Super tab for selecting load testing tool
function LoadTestingToolTabs({ loadTestingTool, setLoadTestingTool }) {
  return (
    <div className="super-tabs" style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
      <button
        className={`super-tab${loadTestingTool === 'jmeter' ? ' active' : ''}`}
        onClick={() => setLoadTestingTool('jmeter')}
        style={{marginRight: 8, padding: '6px 18px', borderRadius: 5, border: '1px solid #d1d5db', background: loadTestingTool==='jmeter' ? '#e0e7ff' : '#f1f5f9', color: loadTestingTool==='jmeter' ? '#1e293b' : '#64748b', fontWeight: loadTestingTool==='jmeter' ? 600 : 400}}
      >
        JMeter
      </button>
      <button
        className={`super-tab${loadTestingTool === 'ab' ? ' active' : ''}`}
        onClick={() => setLoadTestingTool('ab')}
        style={{padding: '6px 18px', borderRadius: 5, border: '1px solid #d1d5db', background: loadTestingTool==='ab' ? '#e0e7ff' : '#f1f5f9', color: loadTestingTool==='ab' ? '#1e293b' : '#64748b', fontWeight: loadTestingTool==='ab' ? 600 : 400}}
      >
        ab
      </button>
    </div>
  );
}

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

function LineChart({ data, showApache, showNode, loadTestingTool }) {
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
  }, [data, showApache, showNode, loadTestingTool]);
  return <canvas ref={canvasRef} height="110"></canvas>;
}

function MetricsBar({ apache, node, showApache, showNode, loadTestingTool }) {
  // Normalization for bar height
  const maxResp = Math.max(apache.avgResponse, node.avgResponse);
  const maxThrough = Math.max(apache.throughput, node.throughput);
  const maxErr = Math.max(apache.errors, node.errors);
  const maxTime = Math.max(apache.timeTaken, node.timeTaken);

  const highErr = (server) =>  55 * (maxErr > 0 ? (server.errors/maxErr) : 0) + 5;
  const highResp = (server) => 55 * (maxResp > 0 ? (server.avgResponse/maxResp) : 0) + 5;
  const highThrough = (server) => 55 * (maxThrough > 0 ? (server.throughput/maxThrough) : 0) + 5;
  const highTime = (server) => 55 * (maxTime > 0 ? (server.timeTaken/maxTime) : 0) + 5;

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
        <div className="metric-title">⏱️ Time taken (s)</div>
        <div className="metric-bar">
          {showApache && <div className="metric-bar-rect metric-bar-apache" style={{height: highTime(apache)}} title={apache.timeTaken}></div>}
          {showNode && <div className="metric-bar-rect metric-bar-node" style={{height: highTime(node)}} title={node.timeTaken}></div>}
        </div>
        <div className="metric-label">
          {showApache && <span style={{color:'#2563eb'}}>Apache: {apache.timeTaken}</span>}
          {showApache && showNode && <span> | </span>}
          {showNode && <span style={{color:'#10b981'}}>Node: {node.timeTaken}</span>}
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
// TODO: Support requests time between 0 and 1 seconds
// Animation of requests
function SimulationAnim({ progress, requests, timeTaken, server }) {
  // Simulated latency to make the animation more visible
  console.log(requests);
  const fakeLatency =  0.5; // Adjust as needed for visibility
  // requests: array of {time, status: 'ok'|'fail'}
  // progress: 0..1
  // server: 'apache' | 'node'
  // Colors
  const color = server === 'apache' ? '#2563eb' : '#10b981';
  const icon = server === 'apache' ? '🧭' : '🚀';
  const serverLabel = server === 'apache' ? 'Apache' : 'Node.js';
  // Only shows the messages that have "arrived" according to progress
  const shown = requests.filter(r => r.time <= progress * timeTaken);
  return (
    <div className="simulation-anim">
      <svg className="simulation-svg" viewBox="0 0 440 160">
        {/* Client */}
        <g>
          <circle cx="50" cy="80" r="28" fill="#f1f5f9" stroke="#64748b" strokeWidth="2" />
          <text x="50" y="85" textAnchor="middle" fontSize="28">👤</text>
        </g>
        {/* Server */}
        <g>
          <rect x="340" y="50" width="70" height="60" rx="12" fill={color} />
          <text x="375" y="88" textAnchor="middle" fontSize="28" fill="#fff">{icon}</text>
        </g>
        {/* Messages */}
        {shown.map((r,i) => {
          const frac = Math.min(1, Math.max(0, (progress * timeTaken - r.time) / (r.latency || fakeLatency)));
          const x = 50 + (290 * frac);
          const y = 80 + (Math.sin(i*0.7)*15);
          return (
            <g key={i}>
              {/* Message */}
              <circle cx={x} cy={y} r="10" fill={r.status==='ok'?color:'#ef4444'} opacity={0.93} />
              <text x={x} y={y+5} textAnchor="middle" fontSize="16" fill="#fff">💬</text>
              {/* Response */}
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
        <span>{timeTaken}s</span>
      </div>
    </div>
  );
}

function SimulationPanel({ tab, running, progressApache, progressNode, apacheMetrics, nodeMetrics, loadTestingTool, runningApache, runningNode }) {
  // State for requests loaded from CSV or fake ab
  const [apacheReqs, setApacheReqs] = React.useState([]);
  const [nodeReqs, setNodeReqs] = React.useState([]);

  React.useEffect(() => {
    if (loadTestingTool === 'jmeter') {
      generateRequestsJmeter('apache').then(setApacheReqs);
      generateRequestsJmeter('node').then(setNodeReqs);
    } else if (loadTestingTool === 'ab') {
      generateRequestsAb('apache').then(setApacheReqs);
      generateRequestsAb('node').then(setNodeReqs);
    }
  }, [loadTestingTool]);

  const showApache = tab==='apache'||tab==='compare';
  const showNode = tab==='node'||tab==='compare';

  const renderContent = (loadData) => (
    <>
      <LineChart data={loadData} showApache={showApache} showNode={showNode} loadTestingTool={loadTestingTool}/>
      <MetricsBar apache={apacheMetrics} node={nodeMetrics} showApache={showApache} showNode={showNode} loadTestingTool={loadTestingTool}/>
      {tab==='compare' ? (
        <div className="split-view">
          <SimulationAnim running={runningApache} tab={tab} progress={progressApache} requests={apacheReqs} errors={apacheMetrics.errors} timeTaken={apacheMetrics.timeTaken} server="apache"/>
          <SimulationAnim running={runningNode} tab={tab} progress={progressNode} requests={nodeReqs} errors={nodeMetrics.errors} timeTaken={nodeMetrics.timeTaken} server="node"/>
        </div>
      ) : tab==='apache' ? (
        <SimulationAnim running={runningApache} tab={tab} progress={progressApache} requests={apacheReqs} errors={apacheMetrics.errors} timeTaken={apacheMetrics.timeTaken} server="apache"/>
      ) : (
        <SimulationAnim running={runningNode} tab={tab} progress={progressNode} requests={nodeReqs} errors={nodeMetrics.errors} timeTaken={nodeMetrics.timeTaken} server="node"/>
      )}
    </>
  );

  return (
    <div>
      {loadTestingTool === 'jmeter'
        ? <JMeterLoadCurve loadTestingTool={loadTestingTool}>{renderContent}</JMeterLoadCurve>
        : <AbLoadCurve loadTestingTool={loadTestingTool}>{renderContent}</AbLoadCurve>
      }
    </div>
  );
}

// Update generateRequests to accept errors as parameter
// Refactored: generateRequests now fetches and parses CSV data
async function generateRequestsJmeter(server) {
  // Only for jmeter; ab uses fake generator
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
    const statusIndex = 3;
    const status = cols[statusIndex].trim();
    if (!timestamp || isNaN(timestamp)) continue;
    const latencyIndex = 14;
    const latency = parseInt(cols[latencyIndex]);
    // Only consider rows with status
    const time = timestamp - firstTimestamp;
    requests.push({
      time: time / 1000, // assuming timestamp is in ms, convert to seconds
      status: status === '201' ? 'ok' : 'fail',
      latency: latency / 1000,
    });
  }
  return requests;
}

async function generateRequestsAb(server) {
  // Only for ab; ab uses fake generator
  const csvFile = server === 'apache' ? 'ab/laravel_ab_simple.csv' : 'ab/node_ab_simple.csv';
  const res = await fetch(csvFile);
  const text = await res.text();
  const lines = text.split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  // Parse CSV rows: timestamp (col 0), status (col 3)
  const requests = [];
  const firstTimestamp = parseInt(lines[1].split(',')[0]);
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 1) continue;
    const timestamp = parseInt(cols[0]);
    const statusIndex = 1;
    const status = cols[statusIndex].trim();
    if (!timestamp || isNaN(timestamp)) continue;
    // Only consider rows with status
    const time = timestamp - firstTimestamp;
    requests.push({
      time: time, // assuming timestamp is in ms, convert to seconds
      status: status === '201' ? 'ok' : 'fail',
      latency: 0.5 / 1000 // TODO: get latency from summary CSV
    });
  }
  return requests;
}

function App() {
  const [loadTestingTool, setLoadTestingTool] = useState('jmeter'); // Default to jmeter
  const [tab, setTab] = useState('compare');
  const [running, setRunning] = useState(false);
  const [runningApache, setRunningApache] = useState(false);
  const [runningNode, setRunningNode] = useState(false);

  const timerRefApache = useRef();
  const timerRefNode = useRef();
  const { apache, node } = useDynamicMetrics(loadTestingTool);

  // Control the simulation
  const [progressApache, setProgressApache] = useState(0);
  const [progressNode, setProgressNode] = useState(0);
  useEffect(() => {
    if (!runningApache) {
      setProgressApache(0);
      if (timerRefApache.current) clearInterval(timerRefApache.current);
      return;
    }
    const start = Date.now();
    timerRefApache.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const progress = Math.min(1, elapsed / Math.max(1, apache.timeTaken));
      setProgressApache(progress);
      if (elapsed >= Math.max(1, apache.timeTaken)) {
        setRunningApache(false);
        clearInterval(timerRefApache.current);
      }
    }, Math.max(1, apache.timeTaken));
    return () => clearInterval(timerRefApache.current);
  }, [runningApache, apache.timeTaken]);

  useEffect(() => {
    if (!runningNode) {
      setProgressNode(0);
      if (timerRefNode.current) clearInterval(timerRefNode.current);
      return;
    }
    const start = Date.now();
    timerRefNode.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const progress = Math.min(1, elapsed / Math.max(1, node.timeTaken));
      setProgressNode(progress);
      if (elapsed >= Math.max(1, node.timeTaken)) {
        setRunningNode(false);
        clearInterval(timerRefNode.current);
      }
    }, Math.max(1, node.timeTaken));
    return () => clearInterval(timerRefNode.current);
  }, [runningNode, node.timeTaken]);

  useEffect(() => {
    if (running) {
      setRunningApache(true);
      setRunningNode(true);
    }
    if (!running) {
      setRunningApache(false);
      setRunningNode(false);
    }
  }, [running]);

  return (
    <div className="simulation-container">
      <h2 style={{textAlign:'center',marginTop:0}}>Simulation Visual: Apache vs Node.js</h2>
      <LoadTestingToolTabs loadTestingTool={loadTestingTool} setLoadTestingTool={setLoadTestingTool} />
      <Tabs tab={tab} setTab={setTab} />
      <PlayStop running={running} onPlay={()=>setRunning(true)} onStop={()=>setRunning(false)} />
      <SimulationPanel
        tab={tab}
        running={running}
        progressApache={progressApache}
        progressNode={progressNode}
        apacheMetrics={apache}
        nodeMetrics={node}
        runningApache={runningApache}
        runningNode={runningNode}
        loadTestingTool={loadTestingTool}
      />
      <div style={{marginTop:'2rem',fontSize:'0.98rem',textAlign:'center',color:'#64748b'}}>
        {loadTestingTool === 'ab' ? (
          <span>Comparing 643 POST requests simulated with concurrency {CONCURRENCY} (chat traffic)</span>
        ) : (
          <span>Comparing 643 POST requests simulated in {Math.max(apache.timeTaken, node.timeTaken)} seconds (chat traffic)</span>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
