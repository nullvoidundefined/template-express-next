import styles from './page.module.scss';

const COMMANDS = ['pnpm install', 'pnpm dev', 'pnpm test', 'pnpm build'];

const STACK_ITEMS = [
    { label: 'Express 5', sublabel: 'API server' },
    { label: 'Next.js 15', sublabel: 'App Router' },
    { label: 'TypeScript', sublabel: 'strict mode' },
    { label: 'pnpm', sublabel: 'workspaces' },
    { label: 'PostgreSQL', sublabel: 'raw SQL' },
];

const WORKSPACES = [
    { desc: 'Express 5 API', path: 'apps/server/' },
    { desc: 'Next.js 15', path: 'apps/client/web/' },
    { desc: 'WXT browser extension', path: 'apps/client/extension/' },
    { desc: 'Expo mobile', path: 'apps/client/mobile/' },
    { desc: 'design tokens', path: 'packages/tokens/' },
    { desc: 'shared TypeScript types', path: 'packages/types/' },
    { desc: 'shared client utilities', path: 'packages/client-shared/' },
];

function HomePage() {
    return (
        <div className={styles.page} data-test-id="home-page">
            <header className={styles.topBar}>
                <span className={styles.topBarLabel}>template · express-next</span>
                <span className={styles.topBarMeta}>pnpm workspaces</span>
            </header>

            <section className={styles.hero} aria-label="Template identity">
                <h1 className={styles.title}>
                    <span className={styles.titleTemplate}>template</span>
                    <span className={styles.titleStack}>express-next</span>
                </h1>
                <p className={styles.tagline}>Clone · configure · ship.</p>
            </section>

            <div className={styles.stackBar} role="list" aria-label="Tech stack">
                {STACK_ITEMS.map(({ label, sublabel }) => (
                    <div key={label} className={styles.stackItem} role="listitem">
                        <span className={styles.stackName}>{label}</span>
                        <span className={styles.stackSub}>{sublabel}</span>
                    </div>
                ))}
            </div>

            <div className={styles.grid}>
                <section className={styles.panel} aria-label="Quick start commands">
                    <h2 className={styles.panelLabel}>quick start</h2>
                    <div className={styles.terminal}>
                        {COMMANDS.map((cmd) => (
                            <div key={cmd} className={styles.cmdLine}>
                                <span className={styles.prompt} aria-hidden="true">
                                    $
                                </span>
                                <code className={styles.cmd}>{cmd}</code>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.panel} aria-label="Monorepo workspaces">
                    <h2 className={styles.panelLabel}>workspaces</h2>
                    <div className={styles.workspaceList}>
                        {WORKSPACES.map(({ desc, path }) => (
                            <div key={path} className={styles.workspaceLine}>
                                <code className={styles.workspacePath}>{path}</code>
                                <span className={styles.workspaceDesc}>{desc}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <footer className={styles.footer}>
                <p className={styles.footerNote}>
                    Replace this page when you&apos;re ready to build.
                </p>
            </footer>
        </div>
    );
}

HomePage.displayName = 'HomePage';

export default HomePage;
