/**
 * ============================================================================
 * CLOUD RESOURCE MONITORING DASHBOARD (PulseCloud v1.0)
 * ============================================================================
 * 
 * Technologies: Pure Vanilla JavaScript (ES2022) + Chart.js v4.4
 * Architecture: Modular Event-Driven Structure
 * 
 * Modules:
 *  1. AppState            - Central reactive state store
 *  2. SimulatedCloudEngine - Telemetry generator & random-walk simulator
 *  3. ChartController     - Chart.js visualizer & theme-aware styler
 *  4. AlertManager        - Threshold monitor, deduplication & toasts
 *  5. TableController     - Server fleet table, search, filter & sorting
 *  6. UIController        - Navigation, modals, themes, and user events
 *  7. CloudAdapterStub    - Extensibility template for AWS CloudWatch API
 * ============================================================================
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. APPLICATION STATE
  // ==========================================================================
  const AppState = {
    // Monitoring Controls
    isLive: true,
    updateIntervalMs: 3500,
    timerId: null,
    uptimeTimerId: null,
    currentRange: '15m',
    currentTheme: localStorage.getItem('pulsecloud_theme') || 'dark',

    // Uptime Anchor (Simulated cluster start time: 34 days, 18 hrs ago)
    clusterStartTime: Date.now() - (34 * 86400 + 18 * 3600 + 42 * 60 + 19) * 1000,

    // Selected Server for Monitoring tab
    selectedTelemetryTarget: 'AGGREGATE', // 'AGGREGATE' or server ID

    // Telemetry History Buffers (for charts)
    historyLimit: 20,
    timeLabels: [],
    historyCpu: [],
    historyMem: [],
    historyNetIn: [],
    historyNetOut: [],

    // Server Fleet Data
    servers: [
      {
        id: 'i-0a89f3b1e84',
        name: 'us-east-1-app-01',
        os: 'Ubuntu 22.04 LTS',
        zone: 'us-east-1a',
        ip: '10.0.1.42',
        type: 't3.xlarge (4 vCPU, 16 GB)',
        cpu: 42.5,
        mem: 61.8,
        netIn: 1248,
        netOut: 845,
        status: 'ONLINE',
        lastUpdated: Date.now(),
        uptimeDays: 28
      },
      {
        id: 'i-09f12c448bb',
        name: 'us-east-1-app-02',
        os: 'Ubuntu 22.04 LTS',
        zone: 'us-east-1b',
        ip: '10.0.1.98',
        type: 't3.xlarge (4 vCPU, 16 GB)',
        cpu: 58.2,
        mem: 68.4,
        netIn: 980,
        netOut: 620,
        status: 'ONLINE',
        lastUpdated: Date.now(),
        uptimeDays: 28
      },
      {
        id: 'i-048e77a299f',
        name: 'eu-west-1-db-primary',
        os: 'Red Hat EL 9',
        zone: 'eu-west-1a',
        ip: '10.2.0.15',
        type: 'r6i.2xlarge (8 vCPU, 64 GB)',
        cpu: 82.4, // Warning (>80%)
        mem: 87.1, // Warning (>85%)
        netIn: 2150,
        netOut: 1890,
        status: 'WARNING',
        lastUpdated: Date.now(),
        uptimeDays: 45
      },
      {
        id: 'i-05d6e1903bc',
        name: 'eu-west-1-db-replica',
        os: 'Red Hat EL 9',
        zone: 'eu-west-1b',
        ip: '10.2.0.26',
        type: 'r6i.xlarge (4 vCPU, 32 GB)',
        cpu: 31.0,
        mem: 45.2,
        netIn: 840,
        netOut: 320,
        status: 'ONLINE',
        lastUpdated: Date.now(),
        uptimeDays: 45
      },
      {
        id: 'i-0672a0e4451',
        name: 'ap-southeast-1-cache',
        os: 'Debian 12',
        zone: 'ap-southeast-1a',
        ip: '10.3.4.12',
        type: 'm6g.large (2 vCPU, 8 GB)',
        cpu: 24.8,
        mem: 72.3,
        netIn: 3400,
        netOut: 3100,
        status: 'ONLINE',
        lastUpdated: Date.now(),
        uptimeDays: 14
      },
      {
        id: 'i-08bb901e33c',
        name: 'us-west-2-auth-srv',
        os: 'Amazon Linux 2023',
        zone: 'us-west-2a',
        ip: '10.4.1.8',
        type: 'c6i.xlarge (4 vCPU, 8 GB)',
        cpu: 51.4,
        mem: 54.0,
        netIn: 620,
        netOut: 580,
        status: 'ONLINE',
        lastUpdated: Date.now(),
        uptimeDays: 32
      },
      {
        id: 'i-011ca998fa7',
        name: 'sa-east-1-media-transcode',
        os: 'Ubuntu 22.04 LTS',
        zone: 'sa-east-1b',
        ip: '10.5.2.89',
        type: 'g4dn.xlarge (4 vCPU, 16 GB)',
        cpu: 76.5,
        mem: 64.2,
        netIn: 4200,
        netOut: 3900,
        status: 'ONLINE',
        lastUpdated: Date.now(),
        uptimeDays: 19
      },
      {
        id: 'i-0988cc21df4',
        name: 'win-backup-agent',
        os: 'Windows Server',
        zone: 'us-east-1c',
        ip: '10.0.9.112',
        type: 't3.large (2 vCPU, 8 GB)',
        cpu: 0.0,
        mem: 0.0,
        netIn: 0,
        netOut: 0,
        status: 'OFFLINE',
        lastUpdated: Date.now() - 120000,
        uptimeDays: 0
      }
    ],

    // Server Table State
    tableSearchQuery: '',
    tableStatusFilter: 'ALL',
    tableOsFilter: 'ALL',
    tableSortField: 'name',
    tableSortOrder: 'asc',

    // Alerts System State
    alerts: [
      {
        id: 'alt-init-1',
        serverId: 'i-048e77a299f',
        serverName: 'eu-west-1-db-primary',
        severity: 'WARNING',
        metric: 'CPU & Memory',
        message: 'CPU usage at 82.4% (>80%) and RAM at 87.1% (>85%) on eu-west-1-db-primary.',
        timestamp: Date.now() - 180000,
        isRead: false,
        isAcknowledged: false,
        status: 'ACTIVE'
      }
    ],
    // Deduplication tracking: maps `${serverId}_${metric}` to last triggered severity
    activeAlertStates: {
      'i-048e77a299f_CPU': 'WARNING',
      'i-048e77a299f_MEM': 'WARNING'
    },
    alertFilterSeverity: 'ALL'
  };

  // ==========================================================================
  // 2. SIMULATED CLOUD ENGINE (DATA PROVIDER)
  // ==========================================================================
  const SimulatedCloudEngine = {
    /**
     * Generate initial historical data points for realistic charts
     */
    initHistory() {
      const now = Date.now();
      const points = AppState.historyLimit;
      const intervalSec = 10;

      for (let i = points - 1; i >= 0; i--) {
        const timePoint = new Date(now - i * intervalSec * 1000);
        AppState.timeLabels.push(this.formatTime(timePoint));

        // Generate smooth baseline data
        const baseCpu = 45 + Math.sin(i / 2) * 12 + (Math.random() * 6 - 3);
        const baseMem = 62 + Math.cos(i / 3) * 6 + (Math.random() * 4 - 2);
        const baseNetIn = 1100 + Math.sin(i / 1.5) * 300 + (Math.random() * 100 - 50);
        const baseNetOut = 750 + Math.cos(i / 1.5) * 200 + (Math.random() * 80 - 40);

        AppState.historyCpu.push(Number(Math.max(10, Math.min(95, baseCpu)).toFixed(1)));
        AppState.historyMem.push(Number(Math.max(20, Math.min(92, baseMem)).toFixed(1)));
        AppState.historyNetIn.push(Math.round(Math.max(200, baseNetIn)));
        AppState.historyNetOut.push(Math.round(Math.max(150, baseNetOut)));
      }
    },

    /**
     * Compute next tick using bounded random-walk for all online servers
     */
    tick() {
      const timestamp = Date.now();
      const timeStr = this.formatTime(new Date(timestamp));

      let totalCpu = 0;
      let totalMem = 0;
      let totalNetIn = 0;
      let totalNetOut = 0;
      let onlineCount = 0;

      // Update each server
      AppState.servers.forEach(server => {
        if (server.status === 'OFFLINE') return;

        // Random walk delta
        const cpuDelta = (Math.random() * 8 - 4);
        const memDelta = (Math.random() * 4 - 2);
        const netInDelta = (Math.random() * 200 - 100);
        const netOutDelta = (Math.random() * 160 - 80);

        server.cpu = Math.max(5, Math.min(99, Number((server.cpu + cpuDelta).toFixed(1))));
        server.mem = Math.max(15, Math.min(98, Number((server.mem + memDelta).toFixed(1))));
        server.netIn = Math.round(Math.max(100, server.netIn + netInDelta));
        server.netOut = Math.round(Math.max(80, server.netOut + netOutDelta));
        server.lastUpdated = timestamp;

        // Evaluate server status based on thresholds
        if (server.cpu > 90) {
          server.status = 'CRITICAL';
        } else if (server.cpu > 80 || server.mem > 85) {
          server.status = 'WARNING';
        } else {
          server.status = 'ONLINE';
        }

        // Run threshold alert checks
        AlertManager.evaluateServerMetrics(server);

        // Accumulate for fleet average
        totalCpu += server.cpu;
        totalMem += server.mem;
        totalNetIn += server.netIn;
        totalNetOut += server.netOut;
        onlineCount++;
      });

      // Calculate averages
      const avgCpu = Number((totalCpu / (onlineCount || 1)).toFixed(1));
      const avgMem = Number((totalMem / (onlineCount || 1)).toFixed(1));
      const avgNetIn = Math.round(totalNetIn / (onlineCount || 1));
      const avgNetOut = Math.round(totalNetOut / (onlineCount || 1));

      // Append to rolling chart history
      AppState.timeLabels.push(timeStr);
      AppState.historyCpu.push(avgCpu);
      AppState.historyMem.push(avgMem);
      AppState.historyNetIn.push(avgNetIn);
      AppState.historyNetOut.push(avgNetOut);

      // Keep fixed buffer size
      if (AppState.timeLabels.length > AppState.historyLimit) {
        AppState.timeLabels.shift();
        AppState.historyCpu.shift();
        AppState.historyMem.shift();
        AppState.historyNetIn.shift();
        AppState.historyNetOut.shift();
      }

      // Refresh UI components
      UIController.updateOverviewCards({ avgCpu, avgMem, avgNetIn, avgNetOut, onlineCount });
      ChartController.updateAllCharts();
      TableController.renderTable();
      UIController.updateLastSyncLabel();
    },

    /**
     * Trigger a deliberate CPU spike on an online server to demonstrate alerts
     */
    simulateSpike() {
      const activeServers = AppState.servers.filter(s => s.status !== 'OFFLINE');
      if (activeServers.length === 0) return;

      // Pick the first or second server
      const target = activeServers[0];
      target.cpu = 94.6; // Exceeds 90% critical threshold
      target.status = 'CRITICAL';
      target.lastUpdated = Date.now();

      AlertManager.evaluateServerMetrics(target);
      UIController.renderAll();
      UIController.showToast('CRITICAL ALERT TEST', `Triggered 94.6% CPU spike on ${target.name}`, 'critical');
    },

    formatTime(date) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  };

  // ==========================================================================
  // 3. CHART CONTROLLER (Chart.js Integration)
  // ==========================================================================
  const ChartController = {
    overviewChart: null,
    cpuChart: null,
    memChart: null,
    netChart: null,
    modalChart: null,

    /**
     * Get theme-aware colors for Chart.js
     */
    getThemeConfig() {
      const isDark = AppState.currentTheme === 'dark';
      return {
        gridColor: isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        textColor: isDark ? '#94A3B8' : '#64748B',
        tooltipBg: isDark ? '#0B132B' : '#FFFFFF',
        tooltipText: isDark ? '#F8FAFC' : '#0F172A',
        tooltipBorder: isDark ? 'rgba(56, 189, 248, 0.3)' : '#CBD5E1'
      };
    },

    /**
     * Initialize all Chart.js instances with modern gradients and options
     */
    initCharts() {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not loaded yet. Skipping chart initialization.');
        return;
      }

      const theme = this.getThemeConfig();

      // Set global Chart.js defaults
      Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
      Chart.defaults.color = theme.textColor;
      Chart.defaults.responsive = true;
      Chart.defaults.maintainAspectRatio = false;
      Chart.defaults.plugins.legend.labels.usePointStyle = true;
      Chart.defaults.plugins.tooltip.backgroundColor = theme.tooltipBg;
      Chart.defaults.plugins.tooltip.titleColor = theme.tooltipText;
      Chart.defaults.plugins.tooltip.bodyColor = theme.tooltipText;
      Chart.defaults.plugins.tooltip.borderColor = theme.tooltipBorder;
      Chart.defaults.plugins.tooltip.borderWidth = 1;
      Chart.defaults.plugins.tooltip.padding = 10;
      Chart.defaults.plugins.tooltip.cornerRadius = 6;

      // 1. Overview Combined Chart (CPU & Memory)
      const ctxOverview = document.getElementById('overviewCombinedChart');
      if (ctxOverview) {
        this.overviewChart = new Chart(ctxOverview, {
          type: 'line',
          data: {
            labels: [...AppState.timeLabels],
            datasets: [
              {
                label: 'Fleet Avg CPU (%)',
                data: [...AppState.historyCpu],
                borderColor: '#38BDF8',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                borderWidth: 2,
                tension: 0.35,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5
              },
              {
                label: 'Fleet Avg RAM (%)',
                data: [...AppState.historyMem],
                borderColor: '#A855F7',
                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                borderWidth: 2,
                tension: 0.35,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5
              }
            ]
          },
          options: {
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: { grid: { color: theme.gridColor }, ticks: { maxTicksLimit: 6 } },
              y: { min: 0, max: 100, grid: { color: theme.gridColor }, ticks: { callback: v => v + '%' } }
            }
          }
        });
      }

      // 2. Monitoring CPU History Chart (with 80% Warning & 90% Critical Threshold Lines)
      const ctxCpu = document.getElementById('chartCpuHistory');
      if (ctxCpu) {
        this.cpuChart = new Chart(ctxCpu, {
          type: 'line',
          data: {
            labels: [...AppState.timeLabels],
            datasets: [
              {
                label: 'CPU Usage (%)',
                data: [...AppState.historyCpu],
                borderColor: '#38BDF8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                borderWidth: 2.5,
                tension: 0.3,
                fill: true,
                pointRadius: 1
              },
              {
                label: 'Warning (80%)',
                data: Array(AppState.historyLimit).fill(80),
                borderColor: '#F59E0B',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
              },
              {
                label: 'Critical (90%)',
                data: Array(AppState.historyLimit).fill(90),
                borderColor: '#EF4444',
                borderWidth: 1.5,
                borderDash: [3, 3],
                pointRadius: 0,
                fill: false
              }
            ]
          },
          options: {
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: { grid: { color: theme.gridColor }, ticks: { maxTicksLimit: 6 } },
              y: { min: 0, max: 100, grid: { color: theme.gridColor }, ticks: { callback: v => v + '%' } }
            }
          }
        });
      }

      // 3. Monitoring Memory History Chart (with 85% Warning threshold)
      const ctxMem = document.getElementById('chartMemHistory');
      if (ctxMem) {
        this.memChart = new Chart(ctxMem, {
          type: 'line',
          data: {
            labels: [...AppState.timeLabels],
            datasets: [
              {
                label: 'Memory Usage (%)',
                data: [...AppState.historyMem],
                borderColor: '#A855F7',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                borderWidth: 2.5,
                tension: 0.3,
                fill: true,
                pointRadius: 1
              },
              {
                label: 'Warning Threshold (85%)',
                data: Array(AppState.historyLimit).fill(85),
                borderColor: '#F59E0B',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
              }
            ]
          },
          options: {
            scales: {
              x: { grid: { color: theme.gridColor }, ticks: { maxTicksLimit: 6 } },
              y: { min: 0, max: 100, grid: { color: theme.gridColor }, ticks: { callback: v => v + '%' } }
            }
          }
        });
      }

      // 4. Monitoring Network History Chart (Inbound vs Outbound)
      const ctxNet = document.getElementById('chartNetworkHistory');
      if (ctxNet) {
        this.netChart = new Chart(ctxNet, {
          type: 'line',
          data: {
            labels: [...AppState.timeLabels],
            datasets: [
              {
                label: 'Inbound Ingress (KB/s)',
                data: [...AppState.historyNetIn],
                borderColor: '#06B6D4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 1
              },
              {
                label: 'Outbound Egress (KB/s)',
                data: [...AppState.historyNetOut],
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 1
              }
            ]
          },
          options: {
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: { grid: { color: theme.gridColor }, ticks: { maxTicksLimit: 8 } },
              y: { grid: { color: theme.gridColor }, ticks: { callback: v => v + ' KB/s' } }
            }
          }
        });
      }
    },

    /**
     * Synchronize all chart datasets with current AppState
     */
    updateAllCharts() {
      const labels = [...AppState.timeLabels];

      if (this.overviewChart) {
        this.overviewChart.data.labels = labels;
        this.overviewChart.data.datasets[0].data = [...AppState.historyCpu];
        this.overviewChart.data.datasets[1].data = [...AppState.historyMem];
        this.overviewChart.update('none'); // Update without full redraw animation for silky smoothness
      }

      if (this.cpuChart) {
        this.cpuChart.data.labels = labels;
        this.cpuChart.data.datasets[0].data = [...AppState.historyCpu];
        this.cpuChart.data.datasets[1].data = Array(labels.length).fill(80);
        this.cpuChart.data.datasets[2].data = Array(labels.length).fill(90);
        this.cpuChart.update('none');
      }

      if (this.memChart) {
        this.memChart.data.labels = labels;
        this.memChart.data.datasets[0].data = [...AppState.historyMem];
        this.memChart.data.datasets[1].data = Array(labels.length).fill(85);
        this.memChart.update('none');
      }

      if (this.netChart) {
        this.netChart.data.labels = labels;
        this.netChart.data.datasets[0].data = [...AppState.historyNetIn];
        this.netChart.data.datasets[1].data = [...AppState.historyNetOut];
        this.netChart.update('none');
      }
    },

    /**
     * Update chart colors when user switches light/dark theme
     */
    applyThemeColors() {
      const theme = this.getThemeConfig();
      const charts = [this.overviewChart, this.cpuChart, this.memChart, this.netChart, this.modalChart];

      charts.forEach(chart => {
        if (!chart) return;
        if (chart.options.scales.x) {
          chart.options.scales.x.grid.color = theme.gridColor;
          chart.options.scales.x.ticks.color = theme.textColor;
        }
        if (chart.options.scales.y) {
          chart.options.scales.y.grid.color = theme.gridColor;
          chart.options.scales.y.ticks.color = theme.textColor;
        }
        chart.update();
      });
    }
  };

  // ==========================================================================
  // 4. ALERT MANAGER (Deduplication, Thresholds & Notifications)
  // ==========================================================================
  const AlertManager = {
    /**
     * Evaluate server metrics against thresholds:
     * - CPU > 90% => CRITICAL
     * - CPU > 80% => WARNING
     * - Memory > 85% => WARNING
     * 
     * Uses state tracking to prevent duplicate alerts every interval!
     */
    evaluateServerMetrics(server) {
      const cpuKey = `${server.id}_CPU`;
      const memKey = `${server.id}_MEM`;

      // 1. CPU Checks
      let currentCpuSeverity = 'NORMAL';
      if (server.cpu > 90) {
        currentCpuSeverity = 'CRITICAL';
      } else if (server.cpu > 80) {
        currentCpuSeverity = 'WARNING';
      }

      const prevCpuSeverity = AppState.activeAlertStates[cpuKey] || 'NORMAL';

      // Check for state transition
      if (currentCpuSeverity !== prevCpuSeverity) {
        if (currentCpuSeverity === 'CRITICAL') {
          this.triggerAlert({
            serverId: server.id,
            serverName: server.name,
            severity: 'CRITICAL',
            metric: 'CPU',
            message: `CRITICAL: CPU usage reached ${server.cpu}% (>90% threshold) on ${server.name}`
          });
        } else if (currentCpuSeverity === 'WARNING') {
          this.triggerAlert({
            serverId: server.id,
            serverName: server.name,
            severity: 'WARNING',
            metric: 'CPU',
            message: `WARNING: High CPU utilization detected at ${server.cpu}% (>80% threshold) on ${server.name}`
          });
        } else if (currentCpuSeverity === 'NORMAL' && prevCpuSeverity !== 'NORMAL') {
          // Auto-resolve notification
          this.triggerAlert({
            serverId: server.id,
            serverName: server.name,
            severity: 'RESOLVED',
            metric: 'CPU',
            message: `RESOLVED: CPU usage on ${server.name} normalized to ${server.cpu}%`
          });
        }
        AppState.activeAlertStates[cpuKey] = currentCpuSeverity;
      }

      // 2. Memory Checks
      let currentMemSeverity = 'NORMAL';
      if (server.mem > 85) {
        currentMemSeverity = 'WARNING';
      }

      const prevMemSeverity = AppState.activeAlertStates[memKey] || 'NORMAL';

      if (currentMemSeverity !== prevMemSeverity) {
        if (currentMemSeverity === 'WARNING') {
          this.triggerAlert({
            serverId: server.id,
            serverName: server.name,
            severity: 'WARNING',
            metric: 'Memory',
            message: `WARNING: Memory consumption exceeded ${server.mem}% (>85% threshold) on ${server.name}`
          });
        } else if (currentMemSeverity === 'NORMAL' && prevMemSeverity !== 'NORMAL') {
          this.triggerAlert({
            serverId: server.id,
            serverName: server.name,
            severity: 'RESOLVED',
            metric: 'Memory',
            message: `RESOLVED: Memory consumption on ${server.name} returned to normal (${server.mem}%)`
          });
        }
        AppState.activeAlertStates[memKey] = currentMemSeverity;
      }
    },

    /**
     * Register a new alert incident
     */
    triggerAlert(data) {
      const alert = {
        id: 'alt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        serverId: data.serverId,
        serverName: data.serverName,
        severity: data.severity,
        metric: data.metric,
        message: data.message,
        timestamp: Date.now(),
        isRead: false,
        isAcknowledged: false,
        status: data.severity === 'RESOLVED' ? 'RESOLVED' : 'ACTIVE'
      };

      // Add to front of alerts list
      AppState.alerts.unshift(alert);

      // Show toast if warning or critical
      if (data.severity === 'CRITICAL' || data.severity === 'WARNING') {
        UIController.showToast(data.severity + ' ALERT', data.message, data.severity.toLowerCase());
      }

      // Update UI displays
      this.renderAlertsUI();
    },

    /**
     * Mark all active alerts as read
     */
    markAllRead() {
      AppState.alerts.forEach(a => { a.isRead = true; });
      this.renderAlertsUI();
    },

    /**
     * Acknowledge all active alerts
     */
    acknowledgeAll() {
      AppState.alerts.forEach(a => {
        a.isRead = true;
        a.isAcknowledged = true;
      });
      this.renderAlertsUI();
      UIController.showToast('Alerts Acknowledged', 'All active alerts have been acknowledged.', 'success');
    },

    /**
     * Clear alert history
     */
    clearHistory() {
      AppState.alerts = [];
      AppState.activeAlertStates = {};
      this.renderAlertsUI();
      UIController.showToast('Alert History Cleared', 'All log entries have been cleared.', 'info');
    },

    /**
     * Update all alert counters, bell badges, dropdowns, and tables
     */
    renderAlertsUI() {
      const unreadCount = AppState.alerts.filter(a => !a.isRead).length;
      const criticalCount = AppState.alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length;
      const warningCount = AppState.alerts.filter(a => a.severity === 'WARNING' && a.status === 'ACTIVE').length;
      const resolvedCount = AppState.alerts.filter(a => a.severity === 'RESOLVED').length;

      // Badges
      const bellBadge = document.getElementById('headerNotifBadge');
      if (bellBadge) {
        bellBadge.textContent = unreadCount;
        bellBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
      }

      const navAlertBadge = document.getElementById('navAlertCount');
      if (navAlertBadge) {
        navAlertBadge.textContent = unreadCount;
        navAlertBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
      }

      // Summary Cards in Section 4
      const elCrit = document.getElementById('countCriticalAlerts');
      if (elCrit) elCrit.textContent = criticalCount;

      const elWarn = document.getElementById('countWarningAlerts');
      if (elWarn) elWarn.textContent = warningCount;

      const elTotal = document.getElementById('countTotalAlertsLogged');
      if (elTotal) elTotal.textContent = AppState.alerts.length;

      const elResolved = document.getElementById('countResolvedAlerts');
      if (elResolved) elResolved.textContent = resolvedCount;

      // Render Dropdown List
      this.renderDropdownList();

      // Render Overview Quick Alerts
      this.renderOverviewQuickAlerts();

      // Render Main Alert Section Log
      this.renderMainAlertLog();
    },

    renderDropdownList() {
      const list = document.getElementById('notifDropdownList');
      if (!list) return;

      if (AppState.alerts.length === 0) {
        list.innerHTML = `
          <div class="notif-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 12l2 2 4-4"></path>
            </svg>
            <p>All cloud systems nominal. No unread alerts.</p>
          </div>
        `;
        return;
      }

      const recent = AppState.alerts.slice(0, 5);
      list.innerHTML = recent.map(a => `
        <div class="notif-item ${a.severity.toLowerCase()}">
          <div class="notif-item-content">
            <div class="notif-item-title">${a.severity}: ${a.metric}</div>
            <div class="notif-item-desc">${a.message}</div>
            <div class="notif-item-time">${UIController.formatRelativeTime(a.timestamp)}</div>
          </div>
        </div>
      `).join('');
    },

    renderOverviewQuickAlerts() {
      const container = document.getElementById('overviewQuickAlerts');
      if (!container) return;

      if (AppState.alerts.length === 0) {
        container.innerHTML = `
          <div class="notif-empty" style="padding: 1.5rem 0;">
            <p style="color: var(--status-success);">✓ All 8 server instances operating within safe thresholds.</p>
          </div>
        `;
        return;
      }

      const displayAlerts = AppState.alerts.slice(0, 3);
      container.innerHTML = displayAlerts.map(a => `
        <div class="quick-alert-card ${a.severity.toLowerCase()}">
          <div class="quick-alert-content">
            <div class="quick-alert-title">${a.severity} — ${a.serverName}</div>
            <div class="quick-alert-desc">${a.message}</div>
          </div>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${UIController.formatRelativeTime(a.timestamp)}</span>
        </div>
      `).join('');
    },

    renderMainAlertLog() {
      const container = document.getElementById('alertListContainer');
      const emptyState = document.getElementById('alertListEmpty');
      if (!container) return;

      let filtered = AppState.alerts;
      if (AppState.alertFilterSeverity !== 'ALL') {
        filtered = AppState.alerts.filter(a => a.severity === AppState.alertFilterSeverity);
      }

      if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      container.innerHTML = filtered.map(a => `
        <div class="alert-item-card ${a.severity.toLowerCase()}">
          <div class="alert-card-left">
            <span class="alert-severity-badge badge-${a.severity.toLowerCase()}">${a.severity}</span>
            <div class="alert-meta-group">
              <span class="alert-item-title">${a.message}</span>
              <span class="alert-item-details">
                Server: <strong>${a.serverName}</strong> (<code>${a.serverId}</code>) • Metric: ${a.metric} • Status: ${a.status}
              </span>
            </div>
          </div>
          <div class="alert-card-right">
            <span class="alert-timestamp">${new Date(a.timestamp).toLocaleTimeString()} (${UIController.formatRelativeTime(a.timestamp)})</span>
            ${!a.isAcknowledged && a.status === 'ACTIVE' ? `
              <button class="btn btn-secondary btn-sm" onclick="window.PulseCloud.acknowledgeAlert('${a.id}')">
                Acknowledge
              </button>
            ` : '<span class="pill pill-neutral">Acknowledged</span>'}
          </div>
        </div>
      `).join('');
    }
  };

  // ==========================================================================
  // 5. SERVER FLEET TABLE CONTROLLER
  // ==========================================================================
  const TableController = {
    /**
     * Filter, sort, and render server fleet rows
     */
    renderTable() {
      const tbody = document.getElementById('serverTableBody');
      const emptyState = document.getElementById('serverTableEmpty');
      const summaryText = document.getElementById('tableSummaryText');
      if (!tbody) return;

      let list = [...AppState.servers];

      // 1. Text Search Filter (Name, ID, OS)
      if (AppState.tableSearchQuery.trim()) {
        const q = AppState.tableSearchQuery.toLowerCase().trim();
        list = list.filter(s => 
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.os.toLowerCase().includes(q)
        );
      }

      // 2. Status Filter Pill
      if (AppState.tableStatusFilter !== 'ALL') {
        list = list.filter(s => s.status === AppState.tableStatusFilter);
      }

      // 3. OS Dropdown Filter
      if (AppState.tableOsFilter !== 'ALL') {
        list = list.filter(s => s.os.toLowerCase().includes(AppState.tableOsFilter.toLowerCase()));
      }

      // 4. Sorting
      list.sort((a, b) => {
        let valA = a[AppState.tableSortField];
        let valB = b[AppState.tableSortField];

        if (AppState.tableSortField === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (AppState.tableSortField === 'updated') {
          valA = a.lastUpdated;
          valB = b.lastUpdated;
        }

        if (valA < valB) return AppState.tableSortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return AppState.tableSortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Update Filter Pill Counts
      this.updatePillCounts();

      // Handle Empty State
      if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (summaryText) summaryText.textContent = `Showing 0 of ${AppState.servers.length} servers`;
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (summaryText) summaryText.textContent = `Showing ${list.length} of ${AppState.servers.length} servers`;

      // Render Rows
      tbody.innerHTML = list.map(server => {
        const cpuColorClass = server.cpu > 90 ? 'fill-critical' : server.cpu > 80 ? 'fill-warning' : 'fill-cpu';
        const memColorClass = server.mem > 85 ? 'fill-warning' : 'fill-memory';
        const rowAlertClass = server.status === 'CRITICAL' ? 'row-critical' : server.status === 'WARNING' ? 'row-warning' : '';

        let statusPillClass = 'pill-success';
        if (server.status === 'WARNING') statusPillClass = 'pill-warning';
        if (server.status === 'CRITICAL') statusPillClass = 'pill-danger';
        if (server.status === 'OFFLINE') statusPillClass = 'pill-neutral';

        return `
          <tr class="${rowAlertClass}">
            <td>
              <span class="server-cell-name">${server.name}</span>
              <span class="server-cell-id">${server.zone}</span>
            </td>
            <td><code>${server.id}</code></td>
            <td>${server.os}</td>
            <td>
              <div class="table-bar-cell">
                <div class="table-bar-track">
                  <div class="table-bar-fill ${cpuColorClass}" style="width: ${server.cpu}%;"></div>
                </div>
                <span class="table-bar-val">${server.cpu}%</span>
              </div>
            </td>
            <td>
              <div class="table-bar-cell">
                <div class="table-bar-track">
                  <div class="table-bar-fill ${memColorClass}" style="width: ${server.mem}%;"></div>
                </div>
                <span class="table-bar-val">${server.mem}%</span>
              </div>
            </td>
            <td>
              <span class="pill ${statusPillClass}">${server.status}</span>
            </td>
            <td>
              <span title="${new Date(server.lastUpdated).toLocaleTimeString()}">
                ${UIController.formatRelativeTime(server.lastUpdated)}
              </span>
            </td>
            <td class="text-right">
              <button class="btn btn-secondary btn-sm" onclick="window.PulseCloud.inspectServer('${server.id}')">
                Inspect
              </button>
            </td>
          </tr>
        `;
      }).join('');
    },

    updatePillCounts() {
      const all = AppState.servers.length;
      const online = AppState.servers.filter(s => s.status === 'ONLINE').length;
      const warning = AppState.servers.filter(s => s.status === 'WARNING').length;
      const critical = AppState.servers.filter(s => s.status === 'CRITICAL').length;
      const offline = AppState.servers.filter(s => s.status === 'OFFLINE').length;

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('countFilterAll', all);
      setEl('countFilterOnline', online);
      setEl('countFilterWarning', warning);
      setEl('countFilterCritical', critical);
      setEl('countFilterOffline', offline);
      setEl('navServerCount', all);
    },

    /**
     * Add a simulated server instance to the fleet
     */
    addServer() {
      const index = AppState.servers.length + 1;
      const zones = ['us-east-1a', 'us-west-2b', 'eu-central-1a', 'ap-south-1a'];
      const osList = ['Ubuntu 22.04 LTS', 'Debian 12', 'Amazon Linux 2023', 'Red Hat EL 9'];

      const newServer = {
        id: 'i-0' + Math.random().toString(16).substring(2, 12),
        name: `custom-node-${String(index).padStart(2, '0')}`,
        os: osList[Math.floor(Math.random() * osList.length)],
        zone: zones[Math.floor(Math.random() * zones.length)],
        ip: `10.0.${Math.floor(Math.random() * 50)}.${Math.floor(Math.random() * 200)}`,
        type: 't3.large (2 vCPU, 8 GB)',
        cpu: Number((20 + Math.random() * 30).toFixed(1)),
        mem: Number((30 + Math.random() * 40).toFixed(1)),
        netIn: Math.round(500 + Math.random() * 800),
        netOut: Math.round(300 + Math.random() * 500),
        status: 'ONLINE',
        lastUpdated: Date.now(),
        uptimeDays: 1
      };

      AppState.servers.push(newServer);
      this.renderTable();
      UIController.populateTelemetryServerDropdown();
      UIController.showToast('Instance Launched', `Server ${newServer.name} (${newServer.id}) initialized.`, 'success');
    }
  };

  // ==========================================================================
  // 6. UI CONTROLLER (Events, Theme, Navigation & Modals)
  // ==========================================================================
  const UIController = {
    init() {
      // 1. Initialize Simulation History & Charts
      SimulatedCloudEngine.initHistory();
      ChartController.initCharts();

      // 2. Initial UI Render
      this.applyTheme(AppState.currentTheme);
      this.startSimulationTimer();
      this.startUptimeTicker();
      this.renderAll();
      this.populateTelemetryServerDropdown();

      // 3. Bind Event Listeners
      this.bindEvents();
    },

    bindEvents() {
      // Sidebar Navigation
      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = link.getAttribute('data-target');
          this.navigateToSection(target);

          // Close mobile sidebar if open
          document.getElementById('sidebar')?.classList.remove('open');
          document.getElementById('sidebarBackdrop')?.classList.remove('open');
        });
      });

      // Mobile Hamburger
      document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.add('open');
        document.getElementById('sidebarBackdrop')?.classList.add('open');
      });

      document.getElementById('sidebarCloseBtn')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarBackdrop')?.classList.remove('open');
      });

      document.getElementById('sidebarBackdrop')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarBackdrop')?.classList.remove('open');
      });

      // Refresh Button (Manual sync)
      document.getElementById('btnRefresh')?.addEventListener('click', () => {
        const icon = document.getElementById('refreshIcon');
        if (icon) icon.classList.add('rotating');

        SimulatedCloudEngine.tick();
        this.showToast('Telemetry Synced', 'Metrics synchronized across all instances.', 'info');

        setTimeout(() => {
          if (icon) icon.classList.remove('rotating');
        }, 600);
      });

      // Pause/Resume Monitoring Button
      document.getElementById('btnPauseResume')?.addEventListener('click', () => {
        AppState.isLive = !AppState.isLive;
        const btnText = document.getElementById('pauseResumeLabel');
        const dot = document.getElementById('liveIndicatorDot');

        if (AppState.isLive) {
          if (btnText) btnText.textContent = 'Pause';
          if (dot) {
            dot.className = 'live-status-indicator live';
          }
          this.startSimulationTimer();
          this.showToast('Monitoring Resumed', 'Live data stream is now active.', 'success');
        } else {
          if (btnText) btnText.textContent = 'Resume';
          if (dot) {
            dot.className = 'live-status-indicator paused';
          }
          this.stopSimulationTimer();
          this.showToast('Monitoring Paused', 'Data stream paused. Click Resume to continue.', 'warning');
        }
      });

      // Theme Toggle (Dark/Light)
      document.getElementById('btnThemeToggle')?.addEventListener('click', () => {
        const newTheme = AppState.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
      });

      // Notifications Bell Toggle
      const notifBtn = document.getElementById('btnNotifToggle');
      const notifDropdown = document.getElementById('notifDropdown');
      notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown?.classList.toggle('show');
        AlertManager.markAllRead();
      });

      document.addEventListener('click', (e) => {
        if (!notifDropdown?.contains(e.target) && !notifBtn?.contains(e.target)) {
          notifDropdown?.classList.remove('show');
        }
      });

      // Mark All Read & Clear Dropdown
      document.getElementById('btnMarkAllRead')?.addEventListener('click', () => {
        AlertManager.markAllRead();
      });

      document.getElementById('btnClearDropdownAlerts')?.addEventListener('click', () => {
        AlertManager.clearHistory();
      });

      document.getElementById('btnViewAllAlerts')?.addEventListener('click', () => {
        notifDropdown?.classList.remove('show');
        this.navigateToSection('alerts');
      });

      document.getElementById('btnGoToAlerts')?.addEventListener('click', () => {
        this.navigateToSection('alerts');
      });

      // Trigger Spike Button
      document.getElementById('btnSimulateSpike')?.addEventListener('click', () => {
        SimulatedCloudEngine.simulateSpike();
      });

      // Server Search Input
      const searchInput = document.getElementById('serverSearchInput');
      const searchClear = document.getElementById('serverSearchClear');
      searchInput?.addEventListener('input', (e) => {
        AppState.tableSearchQuery = e.target.value;
        if (searchClear) searchClear.style.display = e.target.value ? 'block' : 'none';
        TableController.renderTable();
      });

      searchClear?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        AppState.tableSearchQuery = '';
        searchClear.style.display = 'none';
        TableController.renderTable();
      });

      // Server Status Filter Pills
      document.querySelectorAll('#serverStatusFilters .filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('#serverStatusFilters .filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          AppState.tableStatusFilter = pill.getAttribute('data-status');
          TableController.renderTable();
        });
      });

      // OS Filter Select
      document.getElementById('osFilterSelect')?.addEventListener('change', (e) => {
        AppState.tableOsFilter = e.target.value;
        TableController.renderTable();
      });

      // Server Table Sort Headers
      document.querySelectorAll('#serverFleetTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const sortKey = th.getAttribute('data-sort');
          if (AppState.tableSortField === sortKey) {
            AppState.tableSortOrder = AppState.tableSortOrder === 'asc' ? 'desc' : 'asc';
          } else {
            AppState.tableSortField = sortKey;
            AppState.tableSortOrder = 'asc';
          }
          TableController.renderTable();
        });
      });

      // Reset Table Filters Button
      document.getElementById('btnResetServerFilters')?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        AppState.tableSearchQuery = '';
        AppState.tableStatusFilter = 'ALL';
        AppState.tableOsFilter = 'ALL';
        document.querySelectorAll('#serverStatusFilters .filter-pill').forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-status') === 'ALL');
        });
        const osSelect = document.getElementById('osFilterSelect');
        if (osSelect) osSelect.value = 'ALL';
        TableController.renderTable();
      });

      // Launch Instance Button
      document.getElementById('btnSimulateAddServer')?.addEventListener('click', () => {
        TableController.addServer();
      });

      // Telemetry Target Server Select
      document.getElementById('telemetryServerSelect')?.addEventListener('change', (e) => {
        AppState.selectedTelemetryTarget = e.target.value;
        this.updateTelemetrySectionStats();
      });

      // Time Range Select
      document.getElementById('timeRangeSelect')?.addEventListener('change', (e) => {
        AppState.currentRange = e.target.value;
        this.showToast('Time Range Updated', `Telemetry scale adjusted to: ${e.target.value}`, 'info');
      });

      // Alert Filter Pills
      document.querySelectorAll('#alertSeverityFilters .filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('#alertSeverityFilters .filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          AppState.alertFilterSeverity = pill.getAttribute('data-severity');
          AlertManager.renderAlertsUI();
        });
      });

      // Acknowledge All Alerts Button
      document.getElementById('btnAcknowledgeAllAlerts')?.addEventListener('click', () => {
        AlertManager.acknowledgeAll();
      });

      // Clear Alert History Button
      document.getElementById('btnClearAlertHistory')?.addEventListener('click', () => {
        AlertManager.clearHistory();
      });

      // Copy FastAPI Sample Code Button
      document.getElementById('btnCopyFastApiCode')?.addEventListener('click', () => {
        const code = document.getElementById('codeFastApiSample')?.innerText;
        if (code) {
          navigator.clipboard.writeText(code).then(() => {
            this.showToast('Code Copied', 'FastAPI integration snippet copied to clipboard.', 'success');
          }).catch(() => {
            this.showToast('Copy Failed', 'Please copy snippet manually.', 'warning');
          });
        }
      });

      // Modal Dialog Close Buttons
      const modalBackdrop = document.getElementById('serverModalBackdrop');
      document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
        modalBackdrop?.classList.remove('show');
      });
      document.getElementById('modalBtnClose')?.addEventListener('click', () => {
        modalBackdrop?.classList.remove('show');
      });
      modalBackdrop?.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
          modalBackdrop.classList.remove('show');
        }
      });

      // Modal Simulate Reboot Button
      document.getElementById('modalBtnRestart')?.addEventListener('click', () => {
        const id = document.getElementById('modalServerId')?.textContent;
        const server = AppState.servers.find(s => s.id === id);
        if (server) {
          server.status = 'OFFLINE';
          server.cpu = 0;
          server.mem = 0;
          TableController.renderTable();
          this.showToast('Rebooting Instance', `${server.name} reboot cycle initiated...`, 'warning');
          modalBackdrop?.classList.remove('show');

          setTimeout(() => {
            server.status = 'ONLINE';
            server.cpu = 25.0;
            server.mem = 40.0;
            TableController.renderTable();
            this.showToast('Instance Online', `${server.name} has completed reboot and is healthy.`, 'success');
          }, 4000);
        }
      });
    },

    /**
     * Switch view between Overview, Servers, Monitoring, Alerts, and About
     */
    navigateToSection(targetId) {
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-target') === targetId);
      });

      document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
      });

      const activeSection = document.getElementById(`section-${targetId}`);
      if (activeSection) {
        activeSection.classList.add('active');
      }

      // Update Header Title
      const titleMap = {
        overview: 'Dashboard Overview',
        servers: 'Cloud Server Fleet',
        monitoring: 'Live Telemetry & Telemetry',
        alerts: 'System Alert Center',
        about: 'Architecture & Specifications'
      };
      const titleEl = document.getElementById('pageTitle');
      if (titleEl) titleEl.textContent = titleMap[targetId] || 'Dashboard';

      // Update URL hash without jumping
      history.replaceState(null, null, `#${targetId}`);

      // Re-render relevant charts if switching to Monitoring or Overview
      if (targetId === 'monitoring' || targetId === 'overview') {
        setTimeout(() => ChartController.updateAllCharts(), 50);
      }
    },

    /**
     * Apply Light or Dark theme
     */
    applyTheme(theme) {
      AppState.currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('pulsecloud_theme', theme);
      ChartController.applyThemeColors();
    },

    /**
     * Start/stop interval ticker
     */
    startSimulationTimer() {
      this.stopSimulationTimer();
      AppState.timerId = setInterval(() => {
        SimulatedCloudEngine.tick();
      }, AppState.updateIntervalMs);
    },

    stopSimulationTimer() {
      if (AppState.timerId) {
        clearInterval(AppState.timerId);
        AppState.timerId = null;
      }
    },

    /**
     * Increment Uptime display continuously
     */
    startUptimeTicker() {
      if (AppState.uptimeTimerId) clearInterval(AppState.uptimeTimerId);
      AppState.uptimeTimerId = setInterval(() => {
        const diffMs = Date.now() - AppState.clusterStartTime;
        const totalSec = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        const uptimeEl = document.getElementById('cardUptimeValue');
        if (uptimeEl) {
          uptimeEl.textContent = `${days}d ${hours}h ${mins}m ${secs}s`;
        }
      }, 1000);
    },

    /**
     * Update top 6 metric cards on Overview page
     */
    updateOverviewCards(stats) {
      const { avgCpu, avgMem, avgNetIn, avgNetOut, onlineCount } = stats;

      // 1. CPU Card
      const cpuVal = document.getElementById('cardCpuValue');
      const cpuProg = document.getElementById('cardCpuProgress');
      const cpuTrend = document.getElementById('cardCpuTrend');
      if (cpuVal) cpuVal.textContent = avgCpu.toFixed(1);
      if (cpuProg) {
        cpuProg.style.width = `${Math.min(100, avgCpu)}%`;
        cpuProg.className = `progress-bar-fill ${avgCpu > 90 ? 'fill-critical' : avgCpu > 80 ? 'fill-warning' : 'fill-cpu'}`;
      }
      if (cpuTrend) {
        if (avgCpu > 90) {
          cpuTrend.innerHTML = '<span class="text-danger">Critical (&gt;90%)</span>';
        } else if (avgCpu > 80) {
          cpuTrend.innerHTML = '<span class="text-warning">High Load (&gt;80%)</span>';
        } else {
          cpuTrend.innerHTML = '<span class="text-success">Normal Range (&lt;80%)</span>';
        }
      }

      // 2. Memory Card
      const memVal = document.getElementById('cardMemValue');
      const memProg = document.getElementById('cardMemProgress');
      const memRaw = document.getElementById('cardMemRaw');
      if (memVal) memVal.textContent = avgMem.toFixed(1);
      if (memProg) {
        memProg.style.width = `${Math.min(100, avgMem)}%`;
        memProg.className = `progress-bar-fill ${avgMem > 85 ? 'fill-warning' : 'fill-memory'}`;
      }
      if (memRaw) {
        const usedGb = ((avgMem / 100) * 64).toFixed(1);
        memRaw.textContent = `${usedGb} GB / 64 GB`;
      }

      // 3. Network Inbound Card
      const netInVal = document.getElementById('cardNetInValue');
      const netInMb = document.getElementById('cardNetInMb');
      if (netInVal) netInVal.textContent = avgNetIn.toLocaleString();
      if (netInMb) netInMb.textContent = `~${(avgNetIn / 1024).toFixed(2)} MB/s`;

      // 4. Network Outbound Card
      const netOutVal = document.getElementById('cardNetOutValue');
      const netOutMb = document.getElementById('cardNetOutMb');
      if (netOutVal) netOutVal.textContent = avgNetOut.toLocaleString();
      if (netOutMb) netOutMb.textContent = `~${(avgNetOut / 1024).toFixed(2)} MB/s`;

      // 5. Server Status Card
      const totalServers = AppState.servers.length;
      const warningCount = AppState.servers.filter(s => s.status === 'WARNING').length;
      const criticalCount = AppState.servers.filter(s => s.status === 'CRITICAL').length;
      const offlineCount = AppState.servers.filter(s => s.status === 'OFFLINE').length;

      const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
      setEl('fleetOnlineCount', onlineCount);
      setEl('fleetWarningCount', warningCount);
      setEl('fleetOfflineCount', criticalCount + offlineCount);

      const statusText = document.getElementById('cardStatusText');
      const statusDot = document.getElementById('cardStatusDot');
      const healthPct = document.getElementById('fleetHealthPercent');

      const healthRatio = ((onlineCount / totalServers) * 100).toFixed(1);
      if (healthPct) healthPct.textContent = `${healthRatio}% Healthy`;

      if (criticalCount > 0) {
        if (statusText) { statusText.textContent = 'DEGRADED'; statusText.className = 'metric-value metric-status-text text-danger'; }
        if (statusDot) statusDot.className = 'pulse-status-dot offline';
      } else if (warningCount > 0) {
        if (statusText) { statusText.textContent = 'WARNING'; statusText.className = 'metric-value metric-status-text text-warning'; }
        if (statusDot) statusDot.className = 'pulse-status-dot warning';
      } else {
        if (statusText) { statusText.textContent = 'ONLINE'; statusText.className = 'metric-value metric-status-text text-success'; }
        if (statusDot) statusDot.className = 'pulse-status-dot online';
      }

      this.updateTelemetrySectionStats();
    },

    updateTelemetrySectionStats() {
      let targetCpu = 0;
      let targetMem = 0;
      let targetNetIn = 0;
      let targetNetOut = 0;

      if (AppState.selectedTelemetryTarget === 'AGGREGATE') {
        const lastIdx = AppState.historyCpu.length - 1;
        targetCpu = AppState.historyCpu[lastIdx] || 0;
        targetMem = AppState.historyMem[lastIdx] || 0;
        targetNetIn = AppState.historyNetIn[lastIdx] || 0;
        targetNetOut = AppState.historyNetOut[lastIdx] || 0;
      } else {
        const server = AppState.servers.find(s => s.id === AppState.selectedTelemetryTarget);
        if (server) {
          targetCpu = server.cpu;
          targetMem = server.mem;
          targetNetIn = server.netIn;
          targetNetOut = server.netOut;
        }
      }

      const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
      setEl('telemetryCpuCurrent', `${targetCpu}%`);
      setEl('telemetryMemCurrent', `${targetMem}%`);
      setEl('telemetryNetInCurrent', `${targetNetIn.toLocaleString()} KB/s`);
      setEl('telemetryNetOutCurrent', `${targetNetOut.toLocaleString()} KB/s`);
    },

    populateTelemetryServerDropdown() {
      const select = document.getElementById('telemetryServerSelect');
      if (!select) return;

      select.innerHTML = '<option value="AGGREGATE">Fleet Aggregate (Average)</option>';
      AppState.servers.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.id})`;
        select.appendChild(opt);
      });
    },

    updateLastSyncLabel() {
      const label = document.getElementById('lastUpdatedTimestamp');
      if (label) {
        label.textContent = `Last synchronized: ${new Date().toLocaleTimeString()}`;
      }
    },

    formatRelativeTime(timestamp) {
      const sec = Math.floor((Date.now() - timestamp) / 1000);
      if (sec < 5) return 'Just now';
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      return `${hr}h ago`;
    },

    /**
     * Show non-intrusive floating toast notification
     */
    showToast(title, message, type = 'info') {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-msg">${message}</div>
        </div>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
      `;

      toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
      });

      container.appendChild(toast);

      // Auto-dismiss after 4.5 seconds
      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.add('hide');
          setTimeout(() => toast.remove(), 300);
        }
      }, 4500);
    },

    renderAll() {
      TableController.renderTable();
      AlertManager.renderAlertsUI();
    }
  };

  // ==========================================================================
  // 7. GLOBAL WINDOW EXPOSURE & MODAL INSPECTOR
  // ==========================================================================
  window.PulseCloud = {
    inspectServer(serverId) {
      const server = AppState.servers.find(s => s.id === serverId);
      if (!server) return;

      document.getElementById('modalServerName').textContent = server.name;
      document.getElementById('modalServerId').textContent = server.id;
      document.getElementById('modalServerOs').textContent = server.os;
      document.getElementById('modalServerZone').textContent = server.zone;
      document.getElementById('modalServerIp').textContent = server.ip;
      document.getElementById('modalServerUptime').textContent = `${server.uptimeDays} days`;

      const statusEl = document.getElementById('modalServerStatus');
      let pillClass = 'pill-success';
      if (server.status === 'WARNING') pillClass = 'pill-warning';
      if (server.status === 'CRITICAL') pillClass = 'pill-danger';
      if (server.status === 'OFFLINE') pillClass = 'pill-neutral';
      statusEl.innerHTML = `<span class="pill ${pillClass}">${server.status}</span>`;

      // Gauges
      document.getElementById('modalCpuText').textContent = `${server.cpu}%`;
      const cpuBar = document.getElementById('modalCpuBar');
      cpuBar.style.width = `${server.cpu}%`;
      cpuBar.className = `progress-bar-fill ${server.cpu > 90 ? 'fill-critical' : server.cpu > 80 ? 'fill-warning' : 'fill-cpu'}`;

      document.getElementById('modalMemText').textContent = `${server.mem}%`;
      const memBar = document.getElementById('modalMemBar');
      memBar.style.width = `${server.mem}%`;
      memBar.className = `progress-bar-fill ${server.mem > 85 ? 'fill-warning' : 'fill-memory'}`;

      // Render Modal Mini Chart
      const modalCanvas = document.getElementById('modalTelemetryChart');
      if (modalCanvas && typeof Chart !== 'undefined') {
        if (ChartController.modalChart) {
          ChartController.modalChart.destroy();
        }

        const miniLabels = AppState.timeLabels.slice(-10);
        // Synthesize last 10 points around current value
        const miniCpu = miniLabels.map((_, i) => Number(Math.max(5, server.cpu + Math.sin(i) * 6).toFixed(1)));
        const miniMem = miniLabels.map((_, i) => Number(Math.max(10, server.mem + Math.cos(i) * 3).toFixed(1)));

        ChartController.modalChart = new Chart(modalCanvas, {
          type: 'line',
          data: {
            labels: miniLabels,
            datasets: [
              {
                label: 'CPU (%)',
                data: miniCpu,
                borderColor: '#38BDF8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 0
              },
              {
                label: 'Memory (%)',
                data: miniMem,
                borderColor: '#A855F7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 0
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { display: false },
              y: { min: 0, max: 100, ticks: { maxTicksLimit: 5 } }
            }
          }
        });
      }

      document.getElementById('serverModalBackdrop').classList.add('show');
    },

    acknowledgeAlert(alertId) {
      const alert = AppState.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.isAcknowledged = true;
        alert.isRead = true;
        AlertManager.renderAlertsUI();
        UIController.showToast('Incident Acknowledged', `Incident ${alertId} marked as acknowledged.`, 'info');
      }
    }
  };

  // ==========================================================================
  // 8. CLOUD ADAPTER STUB (FUTURE AWS CLOUDWATCH INTEGRATION)
  // ==========================================================================
  /**
   * CloudAdapterStub provides an interface to connect real AWS CloudWatch APIs.
   * In Version 2, replace SimulatedCloudEngine with this adapter pointing to your
   * Python FastAPI / Flask backend proxy.
   */
  const CloudAdapterStub = {
    apiBaseUrl: 'http://localhost:8000/api/v1',

    async fetchFleetMetrics() {
      /*
      try {
        const res = await fetch(`${this.apiBaseUrl}/fleet/telemetry`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
        });
        if (!res.ok) throw new Error('Network response failed');
        return await res.json();
      } catch (err) {
        console.error('CloudWatch API fetch failed:', err);
        return null;
      }
      */
      console.info('CloudAdapterStub ready for AWS CloudWatch backend integration.');
    }
  };

  // ==========================================================================
  // INITIALIZE ON DOM READY
  // ==========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIController.init());
  } else {
    UIController.init();
  }

})();
