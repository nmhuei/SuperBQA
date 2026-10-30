<script lang="ts">
  import { useClientConfig } from '$lib/query/config'
  import { useCurrentUser } from '$lib/query/user'
  import { toast } from '$lib/toast'
  import { copyText } from '$lib/utils/clipboard'
  import { onMount } from 'svelte'

  interface Alert {
    id: string
    teamId: string
    teamName: string
    division: string
    blockedIp: string
    activeIps: string[]
    timestamp: number
    path: string
    method: string
  }

  const configQuery = useClientConfig()
  const userQuery = useCurrentUser()
  const clientConfig = $derived(configQuery.data)
  const divisions = $derived(clientConfig?.divisions ?? {})

  let alerts = $state<Alert[]>([])
  let isLoading = $state(true)
  let isClearing = $state(false)
  let resettingTeamId = $state<string | null>(null)

  // Create team form states
  let newTeamName = $state('')
  let newTeamEmail = $state('')
  let newTeamDivision = $state('')
  let isCreating = $state(false)
  let createdTeam = $state<{
    name: string
    token: string
    loginUrl: string
  } | null>(null)

  const token = () => localStorage.getItem('token') ?? ''

  async function loadAlerts() {
    isLoading = true
    try {
      const res = await fetch('/api/v2/admin/security/alerts', {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      })
      if (res.ok) {
        const json = await res.json()
        alerts = json.data?.alerts ?? []
      } else {
        toast.error('Failed to load security violation alerts')
      }
    } catch (err) {
      toast.error('Network error loading alerts')
    } finally {
      isLoading = false
    }
  }

  async function clearAllAlerts() {
    if (!confirm('Are you sure you want to clear all violation alerts?')) return
    isClearing = true
    try {
      const res = await fetch('/api/v2/admin/security/alerts/clear', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      })
      if (res.ok) {
        alerts = []
        toast.success('All security violation alerts have been cleared.')
      } else {
        toast.error('Failed to clear alerts')
      }
    } catch {
      toast.error('Connection error')
    } finally {
      isClearing = false
    }
  }

  async function resetTeam(teamId: string, teamName: string) {
    if (!confirm(`Reset registered IPs for team "${teamName}"? The team will be permitted to register up to 4 new devices.`)) return
    resettingTeamId = teamId
    try {
      const res = await fetch(`/api/v2/admin/security/teams/${teamId}/reset-ips`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      })
      if (res.ok) {
        toast.success(`Reset IP tracking for team "${teamName}".`)
        await loadAlerts()
      } else {
        toast.error('Failed to reset team IPs')
      }
    } catch {
      toast.error('Connection error')
    } finally {
      resettingTeamId = null
    }
  }

  async function handleCreateTeam(e: SubmitEvent) {
    e.preventDefault()
    if (!newTeamName.trim() || !newTeamEmail.trim() || !newTeamDivision) {
      toast.error('Please fill in Team Name, Email, and Division!')
      return
    }

    isCreating = true
    createdTeam = null
    try {
      const res = await fetch('/api/v2/admin/security/teams/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          name: newTeamName.trim(),
          email: newTeamEmail.trim(),
          division: newTeamDivision,
        }),
      })

      const json = await res.json()
      if (res.ok && json.data) {
        const origin = window.location.origin
        const loginUrl = `${origin}/login?token=${encodeURIComponent(json.data.token)}`
        createdTeam = {
          name: json.data.name,
          token: json.data.token,
          loginUrl,
        }
        toast.success(`Successfully created team "${json.data.name}"!`)
        newTeamName = ''
        newTeamEmail = ''
      } else {
        toast.error(json.message ?? 'Failed to create team')
      }
    } catch {
      toast.error('Error submitting team creation request')
    } finally {
      isCreating = false
    }
  }

  onMount(() => {
    void loadAlerts()
    const timer = setInterval(loadAlerts, 10000) // Auto-refresh every 10 seconds
    return () => clearInterval(timer)
  })
</script>

<svelte:head>
  <title>Security & Anti-Cheat | {clientConfig?.ctfName ?? 'Admin'}</title>
</svelte:head>

<div class="security-panel">
  <header class="panel-header">
    <div class="title-wrap">
      <span class="cyber-badge">SYSTEM SECURITY & ANTI-CHEAT</span>
      <h1 class="panel-title">Security & Team Provisioning</h1>
      <p class="panel-desc">
        Automatically monitors and <strong>blocks the 5th device/IP</strong> attempting to access a team account. Only administrators can provision competition teams.
      </p>
    </div>

    <div class="stats-grid">
      <div class="stat-box">
        <span class="stat-label">Protection Status</span>
        <span class="stat-val active">ACTIVE</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Team IP Limit</span>
        <span class="stat-val highlight">4 IPs / Team</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Blocked Violations</span>
        <span class="stat-val danger">{alerts.length}</span>
      </div>
    </div>
  </header>

  <!-- Section 1: Provision New Team (Admin Only) -->
  <section class="cyber-card">
    <div class="card-head">
      <h2 class="card-title">Provision New Team (Admin Only)</h2>
      <span class="card-badge">Public Registration: DISABLED</span>
    </div>

    <form class="team-form" onsubmit={handleCreateTeam}>
      <div class="form-row">
        <label class="form-group">
          <span>Team Name</span>
          <input
            type="text"
            placeholder="e.g. CyberKnights"
            bind:value={newTeamName}
            required
            disabled={isCreating}
          />
        </label>

        <label class="form-group">
          <span>Team Leader Email</span>
          <input
            type="email"
            placeholder="e.g. captain@usth.edu.vn"
            bind:value={newTeamEmail}
            required
            disabled={isCreating}
          />
        </label>

        <label class="form-group">
          <span>Division</span>
          <select bind:value={newTeamDivision} required disabled={isCreating}>
            <option value="" disabled>-- Select Division --</option>
            {#each Object.entries(divisions) as [val, label]}
              <option value={val}>{label}</option>
            {/each}
          </select>
        </label>

        <div class="form-action">
          <button type="submit" class="cyber-btn primary" disabled={isCreating}>
            {#if isCreating}
              Creating...
            {:else}
              + Create Team
            {/if}
          </button>
        </div>
      </div>
    </form>

    {#if createdTeam}
      <div class="created-result">
        <div class="result-header">
          <span class="success-icon">✓</span>
          <strong>Team "{createdTeam.name}" created successfully!</strong>
        </div>
        <p class="result-desc">
          Send the 1-click login link or credentials below to the team leader (Maximum 4 devices allowed per team):
        </p>

        <div class="token-field">
          <span class="field-label">1-Click Login URL:</span>
          <input type="text" readonly value={createdTeam.loginUrl} />
          <button
            type="button"
            class="cyber-btn"
            onclick={() => {
              if (createdTeam) {
                void copyText(createdTeam.loginUrl, 'Login link copied to clipboard!')
              }
            }}
          >
            Copy Link
          </button>
        </div>

        <div class="token-field">
          <span class="field-label">Team Token:</span>
          <input type="text" readonly value={createdTeam.token} />
          <button
            type="button"
            class="cyber-btn"
            onclick={() => {
              if (createdTeam) {
                void copyText(createdTeam.token, 'Team token copied to clipboard!')
              }
            }}
          >
            Copy Token
          </button>
        </div>
      </div>
    {/if}
  </section>

  <!-- Section 2: Anti-Cheat Violation Alerts (5th IP Blocked) -->
  <section class="cyber-card">
    <div class="card-head">
      <div class="card-head-left">
        <h2 class="card-title">Security Violation Alerts (5th Device Blocked)</h2>
        <span class="auto-refresh-tag">Auto-refreshes every 10s</span>
      </div>

      <div class="card-head-actions">
        <button
          type="button"
          class="cyber-btn"
          disabled={isLoading}
          onclick={() => void loadAlerts()}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>

        {#if alerts.length > 0}
          <button
            type="button"
            class="cyber-btn danger"
            disabled={isClearing}
            onclick={clearAllAlerts}
          >
            {isClearing ? 'Clearing...' : 'Clear All Alerts'}
          </button>
        {/if}
      </div>
    </div>

    {#if alerts.length === 0}
      <div class="empty-state">
        <span class="empty-icon">✓</span>
        <h3>No violations detected!</h3>
        <p>All teams are complying with the 4-device limit (4 unique IPs). No unauthorized 5th device access detected.</p>
      </div>
    {:else}
      <div class="table-wrap">
        <table class="alert-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Team</th>
              <th>5th Blocked IP</th>
              <th>First 4 Allowed IPs</th>
              <th>API Endpoint</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each alerts as alert (alert.id)}
              <tr>
                <td class="col-time">
                  {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  <br />
                  <small>{new Date(alert.timestamp).toLocaleDateString('en-US')}</small>
                </td>
                <td class="col-team">
                  <a href={`/admin/profile/${alert.teamId}`} class="team-link">
                    <strong>{alert.teamName}</strong>
                  </a>
                  <span class="div-tag">{alert.division}</span>
                </td>
                <td class="col-blocked">
                  <span class="blocked-badge">{alert.blockedIp}</span>
                  <small class="blocked-sub">BLOCKED IMMEDIATELY</small>
                </td>
                <td class="col-ips">
                  <div class="ips-list">
                    {#each alert.activeIps as ip, i}
                      <span class="allowed-ip-tag">{i + 1}. {ip}</span>
                    {/each}
                  </div>
                </td>
                <td class="col-path">
                  <code>{alert.method} {alert.path}</code>
                </td>
                <td class="col-act">
                  <button
                    type="button"
                    class="cyber-btn warning"
                    disabled={resettingTeamId === alert.teamId}
                    onclick={() => resetTeam(alert.teamId, alert.teamName)}
                  >
                    {resettingTeamId === alert.teamId ? 'Resetting...' : 'Reset 4 IPs'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>

<style>
  .security-panel {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: clamp(1.5rem, 3vw, 2.5rem);
    max-inline-size: 80rem;
    margin-inline: auto;
    width: 100%;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    flex-wrap: wrap;
    border-bottom: 1px solid rgba(0, 255, 102, 0.2);
    padding-bottom: 1.5rem;
  }

  .title-wrap {
    flex: 1;
    min-inline-size: 20rem;
  }

  .cyber-badge {
    display: inline-block;
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: #00ff66;
    background: rgba(0, 255, 102, 0.1);
    border: 1px solid rgba(0, 255, 102, 0.3);
    padding: 3px 8px;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .panel-title {
    font-size: 1.875rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0.25rem 0 0.5rem;
  }

  .panel-desc {
    font-size: 0.9375rem;
    color: var(--foreground-l2, #b5bfba);
    line-height: 1.5;
    margin: 0;
  }

  .stats-grid {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .stat-box {
    background: rgba(13, 20, 16, 0.85);
    border: 1px solid rgba(0, 255, 102, 0.2);
    border-radius: 8px;
    padding: 0.875rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-inline-size: 8.5rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #8aa193;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .stat-val {
    font-size: 1.25rem;
    font-weight: 800;
    font-family: var(--font-mono, monospace);
  }

  .stat-val.active {
    color: #00ff66;
  }

  .stat-val.highlight {
    color: #00ff66;
  }

  .stat-val.danger {
    color: #ff4d4d;
  }

  .cyber-card {
    background: rgba(13, 20, 16, 0.92);
    border: 1px solid rgba(0, 255, 102, 0.25);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0.875rem;
  }

  .card-head-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .card-badge {
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 77, 77, 0.15);
    color: #ff6666;
    border: 1px solid rgba(255, 77, 77, 0.3);
    font-weight: 600;
  }

  .auto-refresh-tag {
    font-size: 0.75rem;
    color: #00ff66;
    background: rgba(0, 255, 102, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-mono, monospace);
  }

  .card-head-actions {
    display: flex;
    gap: 0.75rem;
  }

  .team-form .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) auto;
    gap: 1rem;
    align-items: flex-end;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-group span {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--foreground-l1, #c9d1cd);
  }

  .form-group input,
  .form-group select {
    background: rgba(8, 12, 10, 0.8);
    border: 1px solid rgba(0, 255, 102, 0.3);
    border-radius: 6px;
    padding: 0.625rem 0.875rem;
    color: #ffffff;
    font-size: 0.9375rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: #00ff66;
    box-shadow: 0 0 10px rgba(0, 255, 102, 0.3);
  }

  .cyber-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    white-space: nowrap;
  }

  .cyber-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }

  .cyber-btn.primary {
    background: #00ff66;
    color: #080c0a;
    border-color: #00ff66;
    font-weight: 700;
  }

  .cyber-btn.primary:hover:not(:disabled) {
    background: #1aff75;
    box-shadow: 0 0 16px rgba(0, 255, 102, 0.6);
  }

  .cyber-btn.danger {
    background: rgba(255, 77, 77, 0.15);
    border-color: rgba(255, 77, 77, 0.4);
    color: #ff6666;
  }

  .cyber-btn.danger:hover:not(:disabled) {
    background: rgba(255, 77, 77, 0.3);
  }

  .cyber-btn.warning {
    background: rgba(255, 170, 0, 0.15);
    border-color: rgba(255, 170, 0, 0.4);
    color: #ffaa00;
    font-size: 0.8125rem;
    padding: 0.375rem 0.75rem;
  }

  .cyber-btn.warning:hover:not(:disabled) {
    background: rgba(255, 170, 0, 0.3);
  }

  .cyber-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .created-result {
    margin-top: 1.5rem;
    padding: 1.25rem;
    background: rgba(0, 255, 102, 0.05);
    border: 1px solid rgba(0, 255, 102, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.0625rem;
    color: #00ff66;
  }

  .result-desc {
    font-size: 0.875rem;
    color: var(--foreground-l2, #b5bfba);
    margin: 0;
  }

  .token-field {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .token-field .field-label {
    inline-size: 9rem;
    font-size: 0.8125rem;
    font-weight: 700;
    color: #00ff66;
  }

  .token-field input {
    flex: 1;
    min-inline-size: 16rem;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(0, 255, 102, 0.2);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    font-family: var(--font-mono, monospace);
    font-size: 0.8125rem;
    color: #ffffff;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: #8aa193;
  }

  .empty-icon {
    font-size: 2.5rem;
    color: #00ff66;
    display: block;
    margin-bottom: 0.5rem;
  }

  .empty-state h3 {
    color: #ffffff;
    margin: 0.25rem 0 0.5rem;
  }

  .empty-state p {
    font-size: 0.875rem;
    max-inline-size: 30rem;
    margin-inline: auto;
  }

  .table-wrap {
    overflow-x: auto;
  }

  .alert-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .alert-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #8aa193;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .alert-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
  }

  .alert-table tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .col-time small {
    color: #8aa193;
    font-size: 0.75rem;
  }

  .team-link {
    color: #00ff66;
    text-decoration: none;
    font-size: 0.9375rem;
  }

  .team-link:hover {
    text-decoration: underline;
  }

  .div-tag {
    display: inline-block;
    font-size: 0.75rem;
    color: #8aa193;
    margin-left: 0.5rem;
  }

  .blocked-badge {
    display: inline-block;
    color: #ff4d4d;
    background: rgba(255, 77, 77, 0.12);
    border: 1px solid rgba(255, 77, 77, 0.3);
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 700;
    font-family: var(--font-mono, monospace);
  }

  .blocked-sub {
    display: block;
    font-size: 0.6875rem;
    color: #ff6666;
    margin-top: 2px;
    font-weight: 600;
  }

  .ips-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .allowed-ip-tag {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    color: #a8ffb2;
  }

  .col-path code {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    background: rgba(0, 0, 0, 0.4);
    padding: 2px 6px;
    border-radius: 4px;
    color: #c9d1cd;
  }
</style>
