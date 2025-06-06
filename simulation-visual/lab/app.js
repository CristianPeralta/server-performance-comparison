const ctx = document.getElementById('latencyChart').getContext('2d');

const latencyChart = new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [
      {
        label: 'API Laravel (JMeter)',
        data: [],
        borderColor: 'rgba(75, 192, 192, 1)',
        fill: false,
        pointRadius: 0,
      },
      {
        label: 'API Node.js (JMeter)',
        data: [],
        borderColor: 'rgba(255, 99, 132, 1)',
        fill: false,
        pointRadius: 0,
      }
    ]
  },
  options: {
    animation: false,
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Tiempo (ms)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Latencia (ms)'
        }
      }
    }
  }
});

async function loadCsvData(server) {
  const csvFile = server === 'apache' ? 'jmeter/laravel_jmeter.csv' : 'jmeter/node_jmeter.csv';
  const res = await fetch(csvFile);
  const text = await res.text();
  const lines = text.split('\n').filter(Boolean);

  if (lines.length <= 1) return [];

  const requests = [];
  const firstTimestamp = parseInt(lines[1].split(',')[0]);

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 15) continue;

    const timestamp = parseInt(cols[0]);
    const latency = parseInt(cols[14]);
    if (isNaN(timestamp) || isNaN(latency)) continue;

    const relativeTime = timestamp - firstTimestamp;

    requests.push({
      x: relativeTime, // tiempo en ms desde el inicio
      y: latency       // latencia en ms
    });
  }
  return requests;
}

async function simulateRequests() {
  const laravelData = await loadCsvData('apache');
  const nodeData = await loadCsvData('node');

  let laravelIndex = 0;
  let nodeIndex = 0;

  const startTime = performance.now();
  const SIMULATION_SPEED = 1.0; // Puedes cambiar a 2.0 para acelerar

  const interval = setInterval(() => {
    const elapsed = (performance.now() - startTime) * SIMULATION_SPEED;

    // Agregar todos los puntos de Laravel que hayan llegado hasta ahora
    while (laravelIndex < laravelData.length && laravelData[laravelIndex].x <= elapsed) {
      latencyChart.data.datasets[0].data.push(laravelData[laravelIndex]);
      laravelIndex++;
    }

    // Agregar todos los puntos de Node que hayan llegado hasta ahora
    while (nodeIndex < nodeData.length && nodeData[nodeIndex].x <= elapsed) {
      latencyChart.data.datasets[1].data.push(nodeData[nodeIndex]);
      nodeIndex++;
    }

    latencyChart.update('none'); // 'none' = sin animación

    // Detener cuando ya no hay más datos que mostrar
    if (laravelIndex >= laravelData.length && nodeIndex >= nodeData.length) {
      clearInterval(interval);
    }

  }, 100); // Actualiza cada 100 ms
}

simulateRequests();
