
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import "./App.css";

const API = "http://127.0.0.1:8000/api";

function App() {
  const [cameras, setCameras] = useState([]);
  const [crowd, setCrowd] = useState([]);
  const [queues, setQueues] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const endpoints = [
          "cameras/",
          "crowd-records/",
          "queue-records/",
          "alerts/",
        ];

        const responses = await Promise.all(
          endpoints.map((endpoint) => fetch(`${API}/${endpoint}`)
        ));

        if (responses.some((response) => !response.ok)) {
          throw new Error("API request failed");
        }

        const data = await Promise.all(
          responses.map((response) => response.json())
        );

        if (!active) return;

        const normalize = (items) =>
          Array.isArray(items) ? items : items.results || [];

        setCameras(normalize(data[0]));
        setCrowd(normalize(data[1]));
        setQueues(normalize(data[2]));
        setAlerts(normalize(data[3]));
        setError("");
        setLastUpdated(new Date().toLocaleTimeString());
      } catch {
        if (active) {
          setError(
            "Could not load data. Check your Django server and API URLs."
          );
        }
      }
    }

    loadDashboard();
    const timer = setInterval(loadDashboard, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const latestCrowd = crowd.reduce(
    (latest, record) =>
      !latest ||
      Number(record.record_id) > Number(latest.record_id)
        ? record
        : latest,
    null
  );

  const latestQueue = queues.reduce(
    (latest, record) =>
      !latest ||
      Number(record.queue_id) > Number(latest.queue_id)
        ? record
        : latest,
    null
  );

  // Find the camera associated with the latest records.
  const relevantCameraId =
    latestCrowd?.camera_id ??
    latestQueue?.camera_id ??
    cameras[0]?.camera_id;

  const monitoredCamera = cameras.find(
    (camera) => Number(camera.camera_id) === Number(relevantCameraId)
  );

  const cameraOnline =
    String(monitoredCamera?.status ?? "").toLowerCase() === "active";

  const crowdCount = Number(latestCrowd?.people_count ?? 0);
  const queueLength = Number(latestQueue?.queue_length ?? 0);
  const waitMinutes = Number(
    latestQueue?.estimated_wait_minutes ?? 0
  );

  // Never present saved counts as current when the camera is offline.
  const displayedCrowd = cameraOnline ? crowdCount : "—";
  const displayedQueue = cameraOnline ? queueLength : "—";
  const displayedWait = cameraOnline ? `${waitMinutes} min` : "—";

  const crowdStatus = !cameraOnline
    ? {
        label: "CAMERA OFFLINE",
        message: "Live crowd monitoring is paused.",
        className: "moderate",
      }
    : crowdCount >= 60
    ? {
        label: "HIGH CROWD",
        message: "High crowd detected. Please review this area.",
        className: "high",
      }
    : crowdCount >= 40
    ? {
        label: "MODERATE CROWD",
        message: "Crowd level is increasing. Keep monitoring.",
        className: "moderate",
      }
    : {
        label: "NORMAL",
        message: "Crowd level is within the normal range.",
        className: "normal",
      };

  const crowdChartData = [...crowd]
    .sort(
      (a, b) => Number(a.record_id) - Number(b.record_id)
    )
    .slice(-10)
    .map((record, index) => ({
      name: `#${index + 1}`,
      people: Number(record.people_count ?? 0),
    }));

  const queueChartData = [...queues]
    .sort(
      (a, b) => Number(a.queue_id) - Number(b.queue_id)
    )
    .slice(-10)
    .map((record, index) => ({
      name: `#${index + 1}`,
      people: Number(record.queue_length ?? 0),
    }));

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">AI</div>
          <div>
            <p className="eyebrow">SMART MONITORING SYSTEM</p>
            <h1>AI Crowd &amp; Queue Prediction</h1>
            <p className="subtitle">
              Real-time crowd monitoring and queue analytics
            </p>
          </div>
        </div>

        <span className="live-badge">
          <span className="live-dot" />
          {cameraOnline ? "Live Dashboard" : "Camera Offline"}
        </span>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="overview-heading">
        <div>
          <h2>Overview</h2>
          <p>
            Monitor cameras, crowd activity, queues, and alerts in one place.
          </p>
        </div>
        <span className="updated">
          Updated {lastUpdated || "waiting for data"}
        </span>
      </section>

      {!cameraOnline && (
        <section className="panel" role="status">
          <h2>Camera Offline</h2>
          <p>
            Live detection has stopped. Crowd and queue counts are hidden
            until the camera is active again. Historical records remain
            available in the charts and recent-records section.
          </p>
        </section>
      )}

      <section className="stats">
        <article className="stat-card camera-card">
          <span className="stat-icon">CAM</span>
          <p>Registered Cameras</p>
          <h2>{cameras.length}</h2>
          <span>Monitoring devices</span>
        </article>

        <article className="stat-card crowd-card">
          <span className="stat-icon">USR</span>
          <p>Latest Crowd Count</p>
          <h2>{displayedCrowd}</h2>
          <span>{cameraOnline ? "People detected live" : "No live count"}</span>
        </article>

        <article className="stat-card queue-card">
          <span className="stat-icon">QUE</span>
          <p>Queue Length</p>
          <h2>{displayedQueue}</h2>
          <span>{cameraOnline ? "People waiting" : "No live queue count"}</span>
        </article>

        <article className="stat-card wait-card">
          <span className="stat-icon">MIN</span>
          <p>Estimated Wait</p>
          <h2>{displayedWait}</h2>
          <span>
            {cameraOnline ? "Estimated waiting time" : "Unavailable offline"}
          </span>
        </article>
      </section>

      <section className={`panel crowd-alert ${crowdStatus.className}`}>
        <div className="alert-symbol">
          {!cameraOnline
            ? "!"
            : crowdStatus.className === "normal"
            ? "✓"
            : "!"}
        </div>

        <div className="crowd-alert-content">
          <h2>{crowdStatus.label}</h2>
          <p>{crowdStatus.message}</p>
          {cameraOnline ? (
            <span>
              Current count: {crowdCount} people · High-crowd threshold: 60
            </span>
          ) : (
            <span>
              Last saved crowd count: {latestCrowd?.people_count ?? "No records"}
            </span>
          )}
        </div>

        <span className="alert-indicator">
          {!cameraOnline
            ? "Monitoring paused"
            : crowdStatus.className === "high"
            ? "Attention required"
            : crowdStatus.className === "moderate"
            ? "Monitor closely"
            : "All clear"}
        </span>
      </section>

      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Crowd Count Trend</h2>
            <p>Historical crowd activity across recent observations</p>
          </div>
          <span className="count">{crowdChartData.length} records</span>
        </div>

        <div className="chart">
          {crowdChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={crowdChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="people"
                  name="People"
                  stroke="#625bff"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>No crowd records available yet.</p>
          )}
        </div>
      </section>

      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Queue Length Trend</h2>
            <p>Historical queue activity and waiting people</p>
          </div>
          <span className="count">{queueChartData.length} records</span>
        </div>

        <div className="chart">
          {queueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={queueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="people"
                  name="Queue length"
                  stroke="#ff9800"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>No queue records available yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Camera Monitoring</h2>
            <p>Registered cameras and their current status</p>
          </div>
          <span className="count">{cameras.length} cameras</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Camera ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((camera) => (
                <tr key={camera.camera_id}>
                  <td>CAM-{camera.camera_id}</td>
                  <td>{camera.camera_name}</td>
                  <td>{camera.location}</td>
                  <td>
                    <span
                      className={`camera-status ${
                        String(camera.status).toLowerCase() === "active"
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      {camera.status}
                    </span>
                  </td>
                </tr>
              ))}

              {cameras.length === 0 && (
                <tr>
                  <td colSpan="4">No cameras found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bottom-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Queue Records</h2>
              <p>Saved waiting-line measurements (historical)</p>
            </div>
          </div>

          {[...queues]
            .sort(
              (a, b) => Number(b.queue_id) - Number(a.queue_id)
            )
            .slice(0, 5)
            .map((queue) => (
              <div className="record" key={queue.queue_id}>
                <div>
                  <strong>Camera {queue.camera_id}</strong>
                  <p>Queue ID: {queue.queue_id}</p>
                </div>
                <div className="record-value">
                  <strong>{queue.queue_length} people</strong>
                  <p>{queue.estimated_wait_minutes} min wait</p>
                </div>
              </div>
            ))}

          {queues.length === 0 && <p>No queue records yet.</p>}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Alerts</h2>
              <p>Alerts received from the backend</p>
            </div>
            <span className="count">{alerts.length} total</span>
          </div>

          {[...alerts]
            .sort(
              (a, b) => Number(b.alert_id) - Number(a.alert_id)
            )
            .slice(0, 5)
            .map((alert) => (
              <div className="alert-item" key={alert.alert_id}>
                <span className="alert-icon">!</span>
                <div>
                  <strong>{alert.alert_type}</strong>
                  <p>{alert.message}</p>
                </div>
              </div>
            ))}

          {alerts.length === 0 && <p>No alerts recorded.</p>}
        </article>
      </section>

      <footer className="footer">
        AI Crowd &amp; Queue Prediction System
        <span>Dashboard refreshes every 5 seconds</span>
      </footer>
    </main>
  );
}

export default App;
