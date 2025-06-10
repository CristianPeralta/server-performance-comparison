// main.js
const { useState, useRef, useEffect, useMemo } = React;

// simulation-visual/pubsub.js
class PubSub {
  constructor() {
    this.subscribers = {};
  }
  subscribe(event, callback) {
    if (!this.subscribers[event]) this.subscribers[event] = [];
    this.subscribers[event].push(callback);
    return () => {
      this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
    };
  }
  publish(event, data) {
    if (!this.subscribers[event]) return;
    this.subscribers[event].forEach(cb => cb(data));
  }
}
const pubsub = new PubSub();

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

function LineChart({ showApache, showNode }) {
  const canvasRef = React.useRef();
  const chartRef = React.useRef();
  const [apachePoints, setApachePoints] = React.useState([]);
  const [nodePoints, setNodePoints] = React.useState([]);

  React.useEffect(() => {
    // Subscribe to the simulation event
    const unsubscribe = pubsub.subscribe('simulation:data', (data) => {
      if (data.apachePoints) setApachePoints(data.apachePoints);
      if (data.nodePoints) setNodePoints(data.nodePoints);
    });
    return () => unsubscribe();
  }, []);

  // Create and update the chart
  React.useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        datasets: [
          showApache && {
            label: 'Apache',
            data: apachePoints, 
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            tension: 0.22,
            pointRadius: 0,
            borderWidth: 2
          },
          showNode && {
            label: 'Node.js',
            data: nodePoints, 
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            tension: 0.22,
            pointRadius: 0,
            borderWidth: 2
          }
        ].filter(Boolean)
      },
      options: {
        animation: false,
        plugins: {
          legend: { display: true, labels: { color: '#334155' } }
        },
        scales: {
          x: {
            min: 0,
            type: 'linear',
            title: { display: true, text: 'Time (ms)' },
            ticks: { color: '#64748b' },
            grid: { color: 'rgba(100,116,139,0.08)' }
          },
          y: {
            title: { display: true, text: 'Latency (ms)' },
            beginAtZero: true,
            ticks: { color: '#64748b' },
            grid: { color: 'rgba(100,116,139,0.08)' }
          }
        }
      }
    });
    return () => chartRef.current && chartRef.current.destroy();
  }, [apachePoints, nodePoints, showApache, showNode]);

  return <canvas ref={canvasRef} height="110"></canvas>;
}

function MetricsBar({ showApache, showNode }) {
  // Local state for metrics
  const [apacheMetrics, setApacheMetrics] = React.useState(DEFAULT_APACHE_METRICS);
  const [nodeMetrics, setNodeMetrics] = React.useState(DEFAULT_NODE_METRICS);

  React.useEffect(() => {
    // Subscribe to the simulation event
    const unsubscribe = pubsub.subscribe('simulation:data', (data) => {
      if (data.apacheMetrics) setApacheMetrics(data.apacheMetrics);
      if (data.nodeMetrics) setNodeMetrics(data.nodeMetrics);
    });
    return () => unsubscribe();
  }, []);

  // Normalization for bar height
  const maxResp = Math.max(apacheMetrics.avgResponse, nodeMetrics.avgResponse);
  const maxThrough = Math.max(apacheMetrics.throughput, nodeMetrics.throughput);
  const maxErr = Math.max(apacheMetrics.errors, nodeMetrics.errors);
  const maxTime = Math.max(apacheMetrics.timeTaken, nodeMetrics.timeTaken);

  const highErr = (server) =>  55 * (maxErr > 0 ? (server.errors/maxErr) : 0) + 5;
  const highResp = (server) => 55 * (maxResp > 0 ? (server.avgResponse/maxResp) : 0) + 5;
  const highThrough = (server) => 55 * (maxThrough > 0 ? (server.throughput/maxThrough) : 0) + 5;
  const highTime = (server) => 55 * (maxTime > 0 ? (server.timeTaken/maxTime) : 0) + 5;

  return (
    <div className="metrics-bar">
      <div className="metric">
        <div className="metric-title">⏱️ Average response time (ms)</div>
        <div className="metric-bar">
          {showApache && <div className="metric-bar-rect metric-bar-apache" style={{height: highResp(apacheMetrics)}} title={apacheMetrics.avgResponse}></div>}
          {showNode && <div className="metric-bar-rect metric-bar-node" style={{height: highResp(nodeMetrics)}} title={nodeMetrics.avgResponse}></div>}
        </div>
        <div className="metric-label">
          {showApache && <span style={{color:'#2563eb'}}>Apache: {apacheMetrics.avgResponse} ms</span>}
          {showApache && showNode && <span> | </span>}
          {showNode && <span style={{color:'#10b981'}}>Node: {nodeMetrics.avgResponse} ms</span>}
        </div>
      </div>
      <div className="metric">
        <div className="metric-title">📦 Transfer rate (KB/s)</div>
        <div className="metric-bar">
          {showApache && <div className="metric-bar-rect metric-bar-apache" style={{height: highThrough(apacheMetrics)}} title={apacheMetrics.throughput}></div>}
          {showNode && <div className="metric-bar-rect metric-bar-node" style={{height: highThrough(nodeMetrics)}} title={nodeMetrics.throughput}></div>}
        </div>
        <div className="metric-label">
          {showApache && <span style={{color:'#2563eb'}}>Apache: {apacheMetrics.throughput} KB/s</span>}
          {showApache && showNode && <span> | </span>}
          {showNode && <span style={{color:'#10b981'}}>Node: {nodeMetrics.throughput} KB/s</span>}
        </div>
      </div>
      <div className="metric">
        <div className="metric-title">⏱️ Time taken (s)</div>
        <div className="metric-bar">
          {showApache && <div className="metric-bar-rect metric-bar-apache" style={{height: highTime(apacheMetrics)}} title={apacheMetrics.timeTaken}></div>}
          {showNode && <div className="metric-bar-rect metric-bar-node" style={{height: highTime(nodeMetrics)}} title={nodeMetrics.timeTaken}></div>}
        </div>
        <div className="metric-label">
          {showApache && <span style={{color:'#2563eb'}}>Apache: {apacheMetrics.timeTaken}</span>}
          {showApache && showNode && <span> | </span>}
          {showNode && <span style={{color:'#10b981'}}>Node: {nodeMetrics.timeTaken}</span>}
        </div>
      </div>
      <div className="metric">
        <div className="metric-title">❌ Failed requests</div>
        <div className="metric-bar">
          {showApache && <div className="metric-bar-rect metric-bar-apache" style={{height: highErr(apacheMetrics)}} title={apacheMetrics.errors}></div>}
          {showNode && <div className="metric-bar-rect metric-bar-node" style={{height: highErr(nodeMetrics)}} title={nodeMetrics.errors}></div>}
        </div>
        <div className="metric-label">
          {showApache && <span style={{color:'#2563eb'}}>Apache: {apacheMetrics.errors}</span>}
          {showApache && showNode && <span> | </span>}
          {showNode && <span style={{color:'#10b981'}}>Node: {nodeMetrics.errors}</span>}
        </div>
      </div>
    </div>
  );
}

function SimulationAnim({ server }) {
  // Local state for simulation data
  const [progress, setProgress] = React.useState(0);
  const [requests, setRequests] = React.useState([]);
  const [timeTaken, setTimeTaken] = React.useState(60);

  React.useEffect(() => {
    // Subscribe to the simulation event
    const unsubscribe = pubsub.subscribe('simulation:data', (data) => {
      if (data.server && data.server !== server && data.mode === 'dynamic') return;
      // For static mode, update both at once
      if (data.mode === 'static') {
        if (server === 'apache') {
          setRequests(data.apacheRequests || []);
          setProgress(data.progressApache || 1);
          setTimeTaken(data.apacheMetrics?.timeTaken || 60);
        } else if (server === 'node') {
          setRequests(data.nodeRequests || []);
          setProgress(data.progressNode || 1);
          setTimeTaken(data.nodeMetrics?.timeTaken || 60);
        }
      } else if (data.mode === 'dynamic') {
        if (server === 'apache') {
          setRequests(data.apacheRequests || []);
          setProgress(data.progressApache || 0);
          setTimeTaken(data.apacheMetrics?.timeTaken || 60);
        } else if (server === 'node') {
          setRequests(data.nodeRequests || []);
          setProgress(data.progressNode || 0);
          setTimeTaken(data.nodeMetrics?.timeTaken || 60);
        }
      }
    });
    return () => unsubscribe();
  }, [server]);

  // Simulated latency to make the animation more visible
  const fakeLatency = 0.5; // Adjust as needed for visibility
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

function SimulationPanel({ tab }) {
  // Determine what to show based on the tab
  const showApache = tab === 'apache' || tab === 'compare';
  const showNode = tab === 'node' || tab === 'compare';

  return (
    <div>
      <LineChart showApache={showApache} showNode={showNode} />
      <MetricsBar showApache={showApache} showNode={showNode}/>
      {tab === 'compare' ? (
        <div className="split-view">
          <SimulationAnim server="apache"/>
          <SimulationAnim server="node"/>
        </div>
      ) : tab === 'apache' ? (
        <SimulationAnim server="apache"/>
      ) : (
        <SimulationAnim server="node"/>
      )}
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

async function generateRequestsAb(server, {avgResponse}) {
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
      latency: avgResponse / 1000,
    });
  }
  return requests;
}

function App() {
  const [loadTestingTool, setLoadTestingTool] = useState('jmeter');
  const [tab, setTab] = useState('compare');
  const [running, setRunning] = useState(false);
  const { apache, node } = useDynamicMetrics(loadTestingTool);

  // Publish all data at once when the simulation is not running
  React.useEffect(() => {
    if (!running) {
      let cancelled = false;
      const fetchAndPublish = async () => {
        let apacheRequests = [];
        let nodeRequests = [];
        if (loadTestingTool === 'jmeter') {
          apacheRequests = await generateRequestsJmeter('apache');
          nodeRequests = await generateRequestsJmeter('node');
        } else {
          apacheRequests = await generateRequestsAb('apache', apache);
          nodeRequests = await generateRequestsAb('node', node);
        }
        if (cancelled) return;
        pubsub.publish('simulation:data', {
          mode: 'static',
          apachePoints: apacheRequests.map(req => ({ x: req.time, y: req.latency })),
          nodePoints: nodeRequests.map(req => ({ x: req.time, y: req.latency })),
          apacheMetrics: apache,
          nodeMetrics: node,
          apacheRequests,
          nodeRequests,
          progressApache: 1,
          progressNode: 1,
        });
      };
      fetchAndPublish();
      return () => { cancelled = true; };
    }
  }, [running, loadTestingTool, apache, node]);

  // Publish dynamic data during simulation (when running is true)
  React.useEffect(() => {
    if (running) {
      let cancelled = false;
      let intervalApache, intervalNode;

      const fetchAndSimulate = async () => {
        let apacheRequests = [];
        let nodeRequests = [];
        if (loadTestingTool === 'jmeter') {
          apacheRequests = await generateRequestsJmeter('apache');
          nodeRequests = await generateRequestsJmeter('node');
        } else {
          apacheRequests = await generateRequestsAb('apache', apache);
          nodeRequests = await generateRequestsAb('node', node);
        }

        if (cancelled) return;

        let iApache = 0, iNode = 0;
        const totalApache = apache.timeTaken || 60;
        const totalNode = node.timeTaken || 60;
        
        let sharedData = {
          apachePoints: [], nodePoints: [],
          apacheRequests: [], nodeRequests: [],
          progressApache: 0, progressNode: 0,
        };

        const publishSharedData = () => {
          if (cancelled) return;
          pubsub.publish('simulation:data', {
            mode: 'dynamic',
            ...sharedData,
            apacheMetrics: apache,
            nodeMetrics: node,
          });
        };

        intervalApache = setInterval(() => {
          if (cancelled) { clearInterval(intervalApache); return; }
          iApache++;
          sharedData.progressApache = Math.min(1, iApache / apacheRequests.length);
          sharedData.apachePoints = apacheRequests.slice(0, iApache).map(req => ({ x: req.time, y: req.latency }));
          sharedData.apacheRequests = apacheRequests.slice(0, iApache);
          publishSharedData();
          if (iApache >= apacheRequests.length) clearInterval(intervalApache);
        }, totalApache * 1000 / (apacheRequests.length || 1));

        intervalNode = setInterval(() => {
          if (cancelled) { clearInterval(intervalNode); return; }
          iNode++;
          sharedData.progressNode = Math.min(1, iNode / nodeRequests.length);
          sharedData.nodePoints = nodeRequests.slice(0, iNode).map(req => ({ x: req.time, y: req.latency }));
          sharedData.nodeRequests = nodeRequests.slice(0, iNode);
          publishSharedData();
          if (iNode >= nodeRequests.length) clearInterval(intervalNode);
        }, totalNode * 1000 / (nodeRequests.length || 1));
      };

      fetchAndSimulate();
      return () => {
        cancelled = true;
        if (intervalApache) clearInterval(intervalApache);
        if (intervalNode) clearInterval(intervalNode);
      };
    }
  }, [running, loadTestingTool, apache, node]);

  return (
    <div className="simulation-container">
      <h2 style={{textAlign:'center',marginTop:0}}>Simulation Visual: Apache vs Node.js</h2>
      <LoadTestingToolTabs loadTestingTool={loadTestingTool} setLoadTestingTool={setLoadTestingTool} />
      <Tabs tab={tab} setTab={setTab} />
      <PlayStop running={running} onPlay={()=>setRunning(true)} onStop={()=>setRunning(false)} />
      <SimulationPanel tab={tab}/>
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
