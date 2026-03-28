export type ServiceStatus = 'up' | 'degraded' | 'down';
export type IncidentStatus =
    | 'investigating'
    | 'identified'
    | 'monitoring'
    | 'resolved';
export type WorkflowStatus = 'success' | 'failure' | 'pending' | 'cancelled';

export interface Service {
    id: string;
    name: string;
    url: string;
    health_endpoint?: string;
    github_owner?: string;
    github_repo?: string;
    github_branch: string;
    check_interval_seconds: number;
    timeout_ms: number;
    expected_status_code: number;
    screenshot_enabled: boolean;
    tags: string[];
    created_at: string;
    updated_at: string;
    status?: ServiceStatus; // from latest check join
}

export interface Check {
    id: string;
    service_id: string;
    status: ServiceStatus;
    status_code: number | null;
    response_time_ms: number | null;
    dns_time_ms: number | null;
    tls_valid: boolean | null;
    tls_expires_at: string | null;
    error_message: string | null;
    screenshot_path: string | null;
    checked_at: string;
}

export interface Incident {
    id: string;
    service_id: string;
    status: IncidentStatus;
    title: string;
    cause: string | null;
    started_at: string;
    resolved_at: string | null;
    created_at: string;
}

export interface GithubStatus {
    last_commit_sha: string | null;
    last_commit_message: string | null;
    last_commit_author: string | null;
    last_commit_at: string | null;
    workflow_name: string | null;
    workflow_status: WorkflowStatus | null;
    workflow_run_url: string | null;
    build_logs_excerpt?: string | null;
}

export interface DayUptime {
    date: string;
    uptime_percent: number | null;
}

export interface PublicStatus {
    overall: 'operational' | 'degraded' | 'outage';
    services: Array<
        Service & {
            status: ServiceStatus;
            uptime_percent_30d: number;
            response_time_avg_30d: number;
            last_checked_at: string | null;
            github?: {
                ci_status: WorkflowStatus | null;
                last_commit_at: string | null;
            };
        }
    >;
    active_incidents: Incident[];
    uptime_history_90d: DayUptime[];
}
