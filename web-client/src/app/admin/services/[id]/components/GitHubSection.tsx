import type { GithubStatus } from '@/types';

interface GitHubSectionProps {
    github: GithubStatus | null;
    githubOwner?: string | null;
    githubRepo?: string | null;
}

const ciStatusConfig: Record<
    string,
    { dotClass: string; label: string; icon: string }
> = {
    success: {
        dotClass: 'bg-green-500',
        label: 'Passing',
        icon: '✓',
    },
    failure: {
        dotClass: 'bg-red-500',
        label: 'Failing',
        icon: '✗',
    },
    pending: {
        dotClass: 'bg-yellow-500',
        label: 'Running',
        icon: '⟳',
    },
    cancelled: {
        dotClass: 'bg-gray-400',
        label: 'Cancelled',
        icon: '○',
    },
};

function formatCommitDate(dateStr: string | null): string {
    if (!dateStr) {
        return '';
    }
    try {
        const date = new Date(dateStr);
        const diff = Date.now() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) {
            return 'just now';
        }
        if (minutes < 60) {
            return `${minutes}m ago`;
        }
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours}h ago`;
        }
        return `${Math.floor(hours / 24)}d ago`;
    } catch {
        return '';
    }
}

export default function GitHubSection({
    github,
    githubOwner,
    githubRepo,
}: GitHubSectionProps) {
    if (!github && (!githubOwner || !githubRepo)) {
        return (
            <p className="text-sm text-gray-500 italic">
                GitHub not configured for this service.
            </p>
        );
    }

    if (!github) {
        return (
            <p className="text-sm text-gray-500 italic">
                No GitHub data available yet. Data will appear after the next
                poll (every 5 minutes).
            </p>
        );
    }

    const ciConfig = github.workflow_status
        ? ciStatusConfig[github.workflow_status]
        : null;

    const commitUrl =
        githubOwner && githubRepo && github.last_commit_sha
            ? `https://github.com/${githubOwner}/${githubRepo}/commit/${github.last_commit_sha}`
            : null;

    return (
        <div className="space-y-4">
            {/* Latest Commit */}
            {(github.last_commit_sha || github.last_commit_message) && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                        Latest Commit
                    </h3>
                    <div className="flex flex-col gap-1 text-sm">
                        {github.last_commit_sha && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">SHA:</span>
                                {commitUrl ? (
                                    <a
                                        href={commitUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-blue-600 hover:underline"
                                    >
                                        {github.last_commit_sha}
                                    </a>
                                ) : (
                                    <span className="font-mono">
                                        {github.last_commit_sha}
                                    </span>
                                )}
                            </div>
                        )}
                        {github.last_commit_message && (
                            <div className="flex items-start gap-2">
                                <span className="text-gray-500">Message:</span>
                                <span className="text-gray-800">
                                    {github.last_commit_message}
                                </span>
                            </div>
                        )}
                        {github.last_commit_author && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">Author:</span>
                                <span className="text-gray-800">
                                    {github.last_commit_author}
                                </span>
                            </div>
                        )}
                        {github.last_commit_at && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">Time:</span>
                                <span className="text-gray-800">
                                    {formatCommitDate(github.last_commit_at)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CI Status */}
            {github.workflow_name && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                        CI Status
                    </h3>
                    <div className="flex items-center gap-3">
                        {ciConfig && (
                            <div className="flex items-center gap-1.5">
                                <span
                                    className={`inline-block h-2.5 w-2.5 rounded-full ${ciConfig.dotClass}`}
                                />
                                <span
                                    className={`text-sm font-medium ${
                                        github.workflow_status === 'success'
                                            ? 'text-green-700'
                                            : github.workflow_status ===
                                                'failure'
                                              ? 'text-red-700'
                                              : github.workflow_status ===
                                                  'pending'
                                                ? 'text-yellow-700'
                                                : 'text-gray-600'
                                    }`}
                                >
                                    {ciConfig.icon} {ciConfig.label}
                                </span>
                            </div>
                        )}
                        <span className="text-sm text-gray-600">
                            {github.workflow_name}
                        </span>
                        {github.workflow_run_url && (
                            <a
                                href={github.workflow_run_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                            >
                                View run
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Build Logs (only shown on failure) */}
            {'build_logs_excerpt' in github &&
                github.workflow_status === 'failure' &&
                github.build_logs_excerpt && (
                    <details className="rounded-lg border border-red-200 bg-red-50">
                        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
                            Build Logs
                        </summary>
                        <pre className="overflow-x-auto px-4 py-3 text-xs text-gray-700 whitespace-pre-wrap">
                            {github.build_logs_excerpt}
                        </pre>
                    </details>
                )}
        </div>
    );
}
