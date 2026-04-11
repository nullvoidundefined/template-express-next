# Commit Manifest

Doppelscript (doppelscript-old). 522 commits. 2026-04-04 to 2026-04-08.

---

```
1dfdbb05 refactor(generate): move template section above register toggle
fbaefc1a chore(hook): structure-check refines flat-component rule to added-only
7161cfe1 chore(ship): project-level /ship override for doppelscript
7b6577d8 docs(handoff): note audit-agent conversion in session handoff
5c13e3f6 chore(commands): convert audit slash commands to thin agent dispatchers
55d70326 docs(handoff): 2026-04-08 session handoff for audit and refactor plan
7d1f9aeb docs(plan): audit-driven refactor plan
c1676e82 chore(claude): move all workspace-specific rules out of root CLAUDE.md
409214d8 chore(claude): split CLAUDE.md into root plus per-workspace files
9aa599ce chore(claude): unify project conventions into a single root CLAUDE.md
535ea3a5 docs(audits): frontend engineering audit (CTO assessment)
01f6bc3c refactor(voices): strip duplicate breadcrumb/header from sub-route pages
06ebb901 refactor(voices): demote voice detail page to the Overview tab body
ffc7d2f6 feat(voices): shared layout with tab bar for voice detail sub-routes
c22eba6e feat(generate): simplify form by inferring mode from input
a2bbcc51 feat(generate): inferMode pure helper for the simplified generate form
c1cc370b feat(nav): reorder secondary nav to Voices/Posts and add Generate CTA
a00ce058 chore(routing): add /app/history redirect stub to /app/posts
12b57e91 refactor(routing): rename /app/history to /app/posts
3ad992fb feat(web-client): wire AccountMenu into AppNav header
36060c07 feat(web-client): add AccountMenu dropdown component
d1b88f8a chore(web-client): add @radix-ui/react-dropdown-menu dependency
b7d560a9 fix(voices): align VoiceExample columns and lift heading out of the card
deb2cdcc docs(handoff): UI cleanup pass brainstorm session restore doc
708cea9f docs(plan): UI cleanup pass implementation plan (13 tasks)
56c5d394 docs(spec): UI cleanup pass design (6 sections)
f535d7c7 docs(handoff): afternoon session wrap after v1 sample storage spec
e02f90c3 docs(spec): v1 sample storage design (launch-blocking, no audit)
58b7cbdc docs(planning): TODO_AFTER_LAUNCH plus afternoon session handoff
1b3373a2 docs(audits): team audit on doppelscript workbench POC spec
d383e497 docs(spec): doppelscript workbench POC design (v2, deferred)
31755e15 feat(voices): restore personality trait editing on voice detail page
c4457bdf chore(gitignore): ignore .superpowers/ brainstorm artifacts
8ca7cf44 refactor(routing): rename /app dashboard to /app/voices
bc2dd691 chore(ui): position umlaut dots over the o glyph instead of the line-box
da85a90c docs(audit): criticism audit fact-checks the 72-hour blog post
0a71fc52 chore(format): prettier sweep on voices mock test fixture
ee1e52f5 feat(voices): Doppelscript ipsum voice example, end to end
b6503ec4 refactor(lifestyle): share option constants between editor and wizard
c1cf7feb feat(ui): markdown rendering on EditorStep preview and PublicGenerator
30d1a4b8 feat(history): render past generations as visual markdown
9c4a641d feat(generator): preserve markdown structure from input in output
34850c21 feat(ui): MarkdownView component, render generated output as visual markdown
04be9bf6 feat(voices): /app/voices/[id]/lifestyle sub-route with mute checklist
73d0e371 feat(settings): /app/settings/lifestyle route + link from settings page
778d55c3 feat(web-client): complete LifestyleFactsEditor to all 11 categories
8a61d640 feat(nav): ambient Generate pill in AppNav with Cmd+K global shortcut
0a1073c6 fix(server): raise body-parser limit to 64kb so 10k-char inputs fit
9693a648 feat(ui): StagedFormBar shared component, used by VoiceRulesEditor
485c6e7a refactor(settings): rename OAuth section and surface orphaned platforms route
2eb7e867 refactor(ux): remove duplicate credit balance from dashboard and settings
2157ca82 docs(audit): UX audit v3 follow-up on ambient generate, nudges, backfill tone
0aa3e79f feat(register): self-serve registration on staging via env gate
2db13340 docs(audit): UX audit v2 covering post-b45de86e state and four founder asks
ee3fc45c docs(audit): customer audit counterpart to UX audit v2
3a5e9f28 fix(dashboard): hide "Generate your first post" banner for returning users (#58)
28b4ba96 docs(handoff): 2026-04-08 evening session handoff
50d4bf94 chore(format): prettier sweep on onboarding redirect test
679c2748 test(e2e): deprecated onboarding routes redirect spec (Phase C2)
4092fea2 chore(routing): redirect deprecated onboarding routes to /app/setup (Phase C1)
a8046f5e feat(generate): firstRun welcome banner (Phase B3 R1)
114fc8fe feat(dashboard): empty state CTA points at /app/setup (Phase B2 R1)
b45de86e feat(voices): demote voice detail page to focused summary view (Phase B1 R2)
7df61c12 test(e2e): setup wizard + voice detail demotion specs (Phase A8)
11795c16 feat(settings): connected accounts dedicated page (Phase A7 R2)
2a258b14 feat(voices): add rules/patterns/vocabulary/danger sub-routes (Phase A6 R2)
c4ee90de feat(setup): wizard step 4 celebratory landing (Phase A5 R1)
4c70d698 feat(setup): wizard step 3 polls voice status with honest copy (Phase A4 R1)
7c9ab4a5 feat(setup): wizard step 2 with three ingestion tabs (Phase A3 R1)
7b541493 feat(setup): wire wizard step 1 to lifestyle facts form (Phase A2 R1)
1b6de162 feat(setup): wizard skeleton with step indicator (Phase A1 R1)
c024a329 feat(web-client): add Lifestyle tab to voice detail page
a3881e4c docs(specs): plan Railway staging consolidation into single project
ad9af2f6 docs(runbooks): add Anthropic key rotation runbook
da0c86c6 chore(ci): add LLM smoke test to post-deploy workflow
c076d919 feat(web-client): add condensed lifestyle onboarding step
c2714a4a feat(web-client): add LifestyleFacts types and API client
b9704ea1 test(generator): live-LLM anti-hallucination integration test
d503eaa4 feat(generator): inject lifestyle facts into system prompt
5a3610c2 feat(generator): renderLifestyleBlock pure function
a0464412 feat(api): integration-test lifestyle facts and voice mute list
4fa51605 feat(api): add GET and PATCH /api/users/lifestyle-facts
1eea9d21 chore(tests): add lifestyle_mute_categories to VoiceProfile mock fixtures
aa011cbe feat(voices): support lifestyleMuteCategories updates
e3755e9a feat(users): add lifestyleFacts repository
16259a9e feat(db): add lifestyle_facts columns and zod schema
f05f0ae4 docs(handoff): final update with staging 401 fix, Vercel cleanup, and ~/.claude drift report
f438955d docs(issues): log staging NEXT_PUBLIC_API_URL incident (A5) and fix runbook
b7bb314d docs(handoff): append UX cleanup spec + plan to 2026-04-08 session handoff
d075de0c docs(spec+plan): UX cleanup for launch (R1 + R2 from 2026-04-08 audit)
cb2f3560 docs(handoff): 2026-04-08 session handoff
a1cdfb6d docs(audits): UX audit (CXO) for 2026-04-08
2f7a4669 chore(tests): add sources_used to mock VoiceProfile fixtures
21d97c29 feat(web-client): show 'Sources used' count in voice detail header
4372896d feat(voices): derive sources_used count on voice profile reads
650c3d33 docs(plan): voice profile source count implementation plan
139b29ec docs(plan): lifestyle facts anti-hallucination implementation plan
a43f1d81 docs(spec): lifestyle facts anti-hallucination design
1e53387d docs(spec): voice profile source count indicator design
2399fd85 docs(audits): land 2026-04-07 financial + marketing audits with spending-cap launch blockers
88b26612 docs(handoff): append continuation session for judges + P0 fixes
b7d14608 feat(judge): replace single judge with parallel linguist + psychologist personas
e94363b3 fix(referrals): add app navigation header so users can return to the app
8521750e fix(generate): honor user maxLength in editor display and token budget
2cf0f8bf docs(handoff): append updates after Resend + Anthropic resolution
768afd10 docs(audits): cost-discipline financial audit
a1dfb90e docs(handoff): 2026-04-07 evening session -- staging environment provisioning
41dc4447 chore(ci): drop --cwd web-client, project rootDirectory handles it
9398d493 chore(ci): drop railway link, project tokens are pre-scoped
13e836b4 chore(types): narrow resolveCorsOrigin return type to OriginFn
375eb734 chore(ci): wire vercel --cwd web-client and railway link in deploy workflows
bba10775 test(e2e): credits buy flow with mocked Stripe Checkout
f0efaae7 test(e2e): update settings-credits spec for inline Top up picker
20a435bb feat(web): wire BalanceCard into credits page, delete legacy modal
576adeb4 feat(web): inline picker with Stripe POST, loading, and error state
0b556c71 feat(web): BalanceCard skeleton with copy block and ARIA placeholders
a4fca45d feat(web): formatCreditCount with concrete-value tests
2eb6ff82 docs(spec): credits page Top up button design
4673ee8f docs(audits): UX and marketing audits of credits buy-button design
c1cdaab8 docs: document staging-first deploy story across project rules
f0c11ca7 docs(runbook): staging environment provisioning runbook
735e0bb3 feat(web): robots.ts reads NEXT_PUBLIC_SITE_URL
e3a73b0b docs(launch): reconcile TODO_BEFORE_LAUNCH with shipped 2026-04-07 work
6d6f68c7 chore(pkg): add 'pnpm promote' shortcut for production deploys
63b34bc8 feat(ci): deploy-production.yml manual promote with required reviewer
56067277 feat(ci): deploy-staging.yml auto-deploys main to staging
30aef4cd test(server): mock analytics.captureException in exportAccount test
64405ba1 chore(scripts): use printf for SUBJECT to avoid shell expansion
e1d17d28 fix(scripts): wait-for-health TIMEOUT validation and test cleanup
12ce0ac1 docs(audit): 2026-04-06 process and test effectiveness retrospective
0c8e24a1 chore: gitignore .pnpm-store/
33da33b9 feat(scripts): verify-pr-checks gates production deploys on ci.yml
dbc36fb4 feat(scripts): post-deploy-summary writes a markdown block
0946735d feat(scripts): wait-for-health polls a URL until 200 or timeout
774709b5 style(cors): wrap rejection-test type union to multiple lines
dfd5e34b feat(server): integrate PostHog analytics and exception capture
134728e0 refactor(cors): hoist allowlist parse out of per-request closure
a7b83b76 feat(cors): support comma-separated CORS_ORIGIN allowlist
5cb3fc47 docs(plan): staging environment implementation plan
897aba55 docs(spec): staging environment design
fbdfee97 docs(runbook): shutdown notification and 30-day wind-down procedure
3eb64281 feat(web): expose /report-abuse via FAQ Q27, footer, settings + E2E
fc5cb662 feat(web): /report-abuse public form + submitAbuseReport client
7670f287 feat(api): POST /api/public/abuse/report handler + route
01890699 feat(email): sendAbuseReport delivers to support@ via Resend
774951dd feat(schemas): reportAbuseSchema with honeypot validation
549efb9e docs(spec): abuse reporting design (public form, email-only, honeypot)
2745a9e2 test(e2e): one-click data export download flow
0e6e0662 feat(web): 'Your data' section on Settings with one-click download
4f77f8f2 feat(web): downloadAccountExport client function
0393a8cd test(integration): GET /api/users/me/export end-to-end
d8006e0d feat(api): GET /api/users/me/export returns JSON attachment
a5da44c6 feat(services): buildUserExport envelope assembly
e8f9b8b7 feat(repo): getUserExportData with 7 parallel read-only queries
bc32310f feat(schemas): Zod schemas + types for data export payload
9088249a docs(plan): data export implementation plan (9 TDD tasks)
54247f41 docs(spec): data export design (self-service, single JSON, synchronous)
5ba338f1 fix(web): /referrals uses new creator verification flow
2e28bc93 test(e2e): tighten upload test to require successful processing
5e76f5ad test(e2e): add hard-delete account flow, trim redundant assertions
4efdd303 feat(web): self-service account deletion UI + E2E + FAQ update
3c2b1da9 test(integration): delete-account soft + hard flows end-to-end
4cef8d21 feat(api): DELETE /api/users/me with soft + hard modes
93422a0f feat(services): userDeletionService orchestrates R2 + hard-delete
ce700508 feat(r2): deleteR2Prefix helper with pagination and empty-skip
d9fbc06e feat(auth): filter soft-deleted users from lookups and session loads
23f12e97 feat(repo): softDeleteUser, hardDeleteUser, findActiveUserById
d665b8ee feat(db): migration 019 adds users.deleted_at + active-users partial index
eabdb816 fix(uploads): refund credits when upload fails after deduction
513d7150 feat(uploads): cap corpus uploads at 200 KB (about 5 pages)
fd5d9c5a fix(web): referral page buttons use accent color, not LinkedIn blue
0b89156a docs(plan): account deletion implementation plan (15 TDD tasks)
321d5cd0 docs(spec): account deletion design (soft + hard, self-service)
40a6e393 docs(handoff): 2026-04-07 session wrap-up, outstanding P1 tasks, next steps
2d9f7029 docs(ISSUES): log em-dash cleanup backlog in CLAUDE.md
7d01de18 feat: privacy page, 2 new blog posts, launch copy, Resend + Sentry, MDX ignore
36db40d7 chore: backlog sweep: dead import, margin docs, settings help, E2E unskip
a62558d9 feat(faq): canonical /faq route with 30 trust-first answers
7a6f386b chore(lefthook): lint and format only staged files on pre-commit
5df72932 docs(CLAUDE.md): add inline-judge subagent dispatch incident
a280f6c4 feat(creator): screenshot-based creator program verification
5c137f11 docs(terms): mirror FAQ commitments into Terms of Service
60d268ed docs(spec): FAQ consolidation brainstorm + always-default-to-truth rule
733a9cb7 docs(rules): ban token streaming in user-facing AI output
27bed9e9 fix(docker): skip prepare hook in deps stage
b59cca10 chore: build voice-judge in root prepare hook and root build script
1a2fe6c7 chore(ci): build voice-judge before type-checking server
174518a9 chore: compile @doppelscript/voice-judge to dist and wire Dockerfile
3b59f692 fix: unbreak server build after inline judge merge
e1da1fcf chore(test): force single-thread execution for server unit tests
ffa39c5d chore: confidence theater purge (Option 1) complete
f56815e7 chore(test): fix 4 additional web-client test regressions
9233d67c chore(test): replace toBeTruthy with concrete fixture assertions
d4c4cf18 chore(test): align GenerationResult over-limit assertion with current label
c2577482 chore(test): click Settings tab before asserting platform and delete UI
b329a3fc chore(test): add originalText prop to EditorStep default props
dc02c8ad chore(test): wrap PricingAnchoring in ToastProvider and update copy
be1d7e53 chore(test): rewrite api error assertions with try/catch + concrete messages
58e808f9 chore(test): update charCountLabel assertions to match current output
72de6caf chore(test): mock next/navigation in history page tests
c487fbea chore(test): set NEXT_PUBLIC_API_URL in vitest setup
9fee118e test(smoke): live Haiku smoke test for judge output parsing
ae44d688 test(integration): real-DB coverage for credits and generations repos
382fa089 refactor(test): rename repo mock tests to *.mock.test.ts for honesty
7dfb4486 docs: outstanding todos snapshot + Option 1 runbook
6c7d35cf test(register): replace form tests with closed-state tests
008f7159 docs: promote three retrospective rules to project CLAUDE.md
2bf5dd56 test(uploads): concrete-value tests for estimateUploadCredits formula
627cb98b chore: Phase 2 code complete; awaiting manual smoke verification
65ac0eb9 chore(e2e): update skip reason after attempted unskip
ba0f5f12 test(e2e): refine flow with mocked API responses via page.route
0b4e63b5 refactor(ui): remove flushSync hack from handleRefine, use findBy in test
ff7cd54c feat(ui): ResultStep refine button and rewrite flow
fc3aa07b feat(web): pollJudgeResult and requestRewrite API methods
cb16f0a6 feat(ui): ThinkingDots loader component
772a0f5e feat(ui): blink-thinking keyframes for rewrite loader
a083c620 feat(api): POST /generations/:id/rewrite endpoint (free, judge-gated)
8b0d5483 Revert "feat(generator): buildRewritePrompt with critique feedback"
4cbe5565 feat(generator): buildRewritePrompt with critique feedback
87073ff5 feat(generator): buildRewritePrompt with critique feedback
3b2e39f6 feat(api): include judgeResult in GET /generations/:id
737bef0b feat(generate): fire background judge when INLINE_JUDGE_ENABLED
b93f1075 feat(service): background judge runner for post-generation scoring
108edb68 feat(repo): getTopCorpusExcerptsByUser for judge voice_fidelity RAG
3572e551 docs: fix Task 2.4 to use platform_posts instead of nonexistent column
96375335 feat(repo): saveJudgeResult and getJudgeResultByGenerationId
c1b8fa67 feat(config): INLINE_JUDGE_ENABLED feature flag
099add74 feat(db): generation_judge_results table
6c7d35cf chore(voice-judge): Phase 1 calibration passed
8368f7b6 fix(voice-judge): strip markdown code fence from Haiku JSON responses
98aa4558 feat(eval): calibration script for judge discrimination gate
30f15d33 test(eval): bland and risky calibration personas
d6c6d3aa feat(generator): integrate plan stripping into generateContent
fcd2785f feat(generator): stripGenerationPlan post-processor
56f72ba4 Revert "feat(generator): require sentence-length variance in system prompt"
e9d0f2b0 feat(generator): require sentence-length variance in system prompt
081006dd feat(generator): require sentence-length variance in system prompt
875de162 chore(generator): reorder plan block after vocabSection per review
f1024832 docs: reorder Task 1.5 placement to after vocabSection
3fee7ca6 feat(generator): narrative plan block in buildGenerationPrompt
e8f61972 chore(eval): document offline corpus limitation and remove redundant import
fcba6557 refactor(eval): wire @doppelscript/voice-judge as workspace dep
a3851420 chore(voice-judge): tighten judge tests and remove dead guard after review
a3647f70 feat(voice-judge): judge core with arc_tension, risk, corpus-RAG, Haiku model
01e4800b docs: fix rhythm-failing baseInput in Task 1.3 of inline judge plan
efdb5234 chore(voice-judge): add sentenceWordCounts tests and tighten embedded punctuation assertion
c070c9e3 feat(voice-judge): rhythm pre-pass utility with stddev computation
5adec4a5 docs: fix broken test case in Task 1.2 of inline judge plan
14b2640f chore(voice-judge): add "type": "module" and type jsdoc after review
de786e9a feat: scaffold @doppelscript/voice-judge workspace package
c17a477a docs: implementation plan for inline judge and generator upgrade
fb5a1cdf docs: spec for inline judge and generator upgrade
5c51aaca chore: add fix-commit discipline gate + global memory pointer
96c9583f fix: render professional_register.changes as objects, not strings
9381eb4f test: unit tests for password flows to clear 80% function coverage threshold
6446dd77 feat: password change and password reset flows
9240b38f fix: copy .npmrc in Dockerfile so Railway matches lockfile pnpm settings
a46464a1 feat: add monetization audit + monetization sections in marketing/UX audits
0c7e4c55 docs: add support@ and feature-requests@ email addresses to launch checklist
7e8caf35 refactor: move audits to docs/audits/ with dated history
f0a7ec59 docs: rewrite launch checklist for current state (registration closed, credits, ai_jobs)
d38fc73e feat: exhaustive e2e test suite + user stories doc + fix dead referral column
99fc4dde refactor: mobile nav scrollable menu bar + rewrite ISSUES.md as rules
eff2cd06 fix: enforce 15% minimum profit margin on upload pricing
d42311d5 fix: charge corpus uploads at cost, not with markup
17f49f63 fix: reduce corpus upload credit cost from 96% margin to 3x markup
7009ae2b feat: add ai_jobs table to track every Anthropic API call
b4c2ee6f feat: credit cost confirmation modal before corpus upload
3aacaf72 fix: remove dead subscription tier system (upload 500 on production)
e6fe1993 fix: replace stale 'Free tier' placeholder with actual credit balance
7f59ddf0 copy: remove explicit LinkedIn references from user-facing text
8211e54e chore: remove passthrough middleware (adds latency for no reason)
2961bf99 feat: remove coming-soon gate, close registration
2f76e647 fix: remove password prefill from login query params
0c8ba2f1 feat: prefill login from ?email= and ?password= query params
7f544a84 feat: prefill login form from ?u= and ?p= query params
3e008c10 feat: consolidate migrations (20 -> 14), revalue credits (1 credit = $0.05)
ab5e6176 fix: remove unused Playwright from Dockerfile (server doesn't use it)
0e5d3709 fix: rateLimiter test type error (Middleware not assignable to RateLimitRequestHandler)
97bad8d4 docs: add issues #32 and #33 (playwright peer, outputFileTracingRoot)
83689424 fix: set outputFileTracingRoot to monorepo root for Vercel serverless
bff788ed test: deploy minimal voice detail page to diagnose Vercel 500
2801ab36 fix: exclude @playwright/test from pnpm peer resolution (Vercel 500)
a92d4a40 fix: remove @playwright/test from web-client (breaks Vercel serverless)
81c346ae fix: remove @playwright/test from root deps (breaks Vercel serverless)
3461acc7 fix: complete platforms.ts with all required types and functions
256e027a chore: clean up error boundaries (remove stack traces from user-facing UI)
9f4e1db7 fix: create missing platforms.ts (root cause of voice detail 500)
1c732b90 fix: add error boundaries to app pages for debugging 500s
f84709b3 fix: delete /account page, fix login redirect, rate limit prod-only, E2E fixes
5b83e858 fix: OAuth route collision blocking /auth/me (500 on Quick Start)
f19b3246 fix: use API_REWRITE_URL for Vercel rewrites, add comprehensive E2E tests
00fc4751 docs: add issues #23-25 (Vercel env var, migration quoting, test scoping)
63d578a3 fix: migration defaults use pgm.func() to prevent triple-quoting on Postgres
2ce9ee4d fix: address 12 audit findings (security, engineering, UX, design, marketing)
7d6482fb feat: add Firefox, Safari, Edge, and mobile to Playwright E2E config
55ac2eca fix: proxy API through Vercel rewrites for Safari ITP compatibility
357a4ab1 docs: add post-audit task list (13 issues from 5 focused audits)
93da315f fix: exclude integration tests from unit test config
593b9f30 docs: overhaul TODO_BEFORE_LAUNCH.md with complete launch checklist
78fdfec2 feat(eval): generate and score initial golden set baseline
e98649bb feat(eval): complete eval system - personas, assertions, judge, generation, CLI
8dd9512e fix: add analyze handler tests, fix coverage thresholds for CI
40fa12d5 docs: add eval system implementation plan (10 tasks)
beb98df6 docs: add eval system design spec (voice fidelity + humanness scoring)
cd8c199a docs: add session issues (#16-20) to ISSUES.md, add commit rules to CLAUDE.md
caef8a4c feat: migrate extension popup to Tailwind CSS [DES-13]
4b37bd34 fix: force pre-push hooks to always run (skip: false)
16eaf833 fix: add unit tests to pre-push hook to catch broken code before pushing
89d5f80d fix: update redisRateLimiter test mock for named Redis import
f60843cb feat: add reusable DataTable component with TanStack Table
96b6e6a7 fix: ioredis import, add TSC to CI, Playwright E2E foundation, Phase 5 remaining
9681354a feat: Phase 5 - creators page, attribution, agency capture, shared packages, docs
70736914 feat: Phase 4 - ratings, shortcuts, tooltips, empty states, credit alerts
ef8fb9ea feat: Phase 3 - blog, voice analyzer, a11y hardening, editor improvements
7a1bc049 chore: remove stale template/project MD files
f00208dc fix: repair broken tests and Zod v4 schema compatibility
3ad7fcf3 docs: mark completed audit tasks as done across all audit files
0135a05c feat: add search, voice filter, and mode filter to history page [UX-3.1]
b2aaba48 feat: add server + client analytics services with mock implementations [ENG-O1, O3, MKT-2.1]
6ebeb913 feat: add server-side error reporting service with Pino mock [ENG-O2]
2a7067a9 feat: update TestimonialWall with spec personas, varied avatar colors, and new heading
987d4b1b feat: reprice credits to $0.50 each with $5 minimum purchase
97c6b19c feat: add 6 expert audit slash commands
2631013e fix: simplify Input component types to fix Next.js build
21083458 feat: mobile generation improvements - sticky button, horizontal scroll templates, 44px tap targets
a9459dfa feat: add email capture with migration, handler, and footer form [MKT-1.4]
70a6854e feat: add PricingAnchoring value anchoring to pricing section [MKT-1.3]
40d3c842 feat: add sequenced loading messages during generation
0f0e4799 feat: add step transitions and micro-interactions to generate page
167e2fc4 refactor: consolidate label and formatting utilities into shared modules
1411134b refactor: split generate page into InputStep, EditorStep, ResultStep components
85d14a82 feat: [ENG-C2] add reusable Input component with textarea variant and error state
2ec92333 feat: [ENG-C1] centralize accent color as CSS token and Tailwind utility
c539e717 refactor: thin out generations handler to use creditService
f57983bc feat: create creditService with generateWithCredits orchestration
a33dde8d test: add failing tests for creditService.generateWithCredits
f0be91bb feat: add autoComplete attributes to auth form fields
ce548abc feat: add AbortController cleanup and auto-clear form errors on input
a1114029 feat: add credit pre-confirmation for low-credit users on generate page
7c4e7db2 feat: add guided first-generation CTA and improved empty states
bab00798 feat: reframe onboarding as progressive path (Quick start vs Deep analysis)
fd97db99 feat: add Skeleton component with card, table, detail, inline variants
0eeba8c1 fix: update referral tests to match balance_after query order
9a06cef1 feat: wire ConfirmDialog into all destructive actions
63a1a5a4 feat: add ConfirmDialog component with tests (Radix AlertDialog)
e7c1a6cf feat: add toast notification system with Radix Toast primitive
7c2e4442 refactor(oauth): replace as unknown as casts with proper Arctic types
34548551 fix(generations): log error type before rethrowing in generation catch block
895f526e fix(oauth): log warning when OAuth state cookie fails to parse
e3222ede fix(auth): propagate 500 when session deletion fails during logout
ef44b457 refactor: use api() in publicGenerate instead of raw fetch
6ea2fc07 feat: add 30s default timeout to api() and apiUpload() helpers
78bffccd refactor: use api()/apiUpload() in CorpusUploader instead of raw fetch
c9a16370 fix: change API URL fallback from port 3000 to 3001
2474b0e4 fix: include balance_after in all credit transaction INSERTs
91ca9644 refactor: consolidate referral reward logic and use REFERRAL_CREDIT_AWARD constant
4a0d051b refactor: extract shared handler utilities (cookies + Zod formatting)
9d27c9ab feat: create TODO_BEFORE_LAUNCH.md tracking mocked integrations
220b4240 docs: add audit files and consolidated TASKS.md (61 tasks)
dbc417a0 docs: UX audit and improvement layer design spec
1854085a feat: add corpus upload credit scaling based on file size
064d5470 feat: add cost guardrails and alerts to Claude API generation calls
9da2af78 refactor: centralize magic numbers into constants directory, update privacy copy
4d103001 feat: per-generation target length setting
7889ddf1 feat: shared RulePill component, platform card redesign, clickable step nav
9ce8a19f feat: trait slider example sentences, account page styling, exclude extension from dev
4a1fb159 fix: cross-domain session cookies, CI integration tests, landing page copy
0e0e1073 feat: social sign-in, terms page, coming soon gate, dark mode removal
589ffe3b fix: update test mock profiles to include vocabulary fields
31d2d9f8 feat: add VocabularyPanel component and integrate into voice profile page
db30c560 feat: integrate vocabulary into content generator and generation handler
1abdefe2 feat: add vocabulary handlers, routes, and app mounting
3b68b747 feat: integrate vocabulary extraction into corpus analysis worker
cac3f77d feat: add vocabularyExtractor service with n-gram frequency analysis
31a5a6c2 feat: add vocabulary fields to VoiceProfile interface and repository
061be4c7 feat: add Zod schemas for vocabulary entries and endpoints
6f554f77 feat: add database migration for vocabulary columns on voice_profiles
53d26b16 feat: add ConnectedAccounts component for settings page
7e6f69e9 feat: add social sign-in buttons and one-click signup copy to register page
1b948cb5 feat: add social sign-in buttons and Twitter link prompt to login page
7f04e423 feat: add SocialSignInButtons component with provider icons
9f330de5 feat: add frontend OAuth API client
ab550675 feat: mount OAuth routes in Express app
c2a66730 feat: add OAuth routes (public redirect/callback + protected API)
b4697ec0 feat: add OAuth handlers (redirect, callback, providers, disconnect, link-twitter)
b3bd507c feat: reject password login for social-only users with helpful message
eb0a7f6f feat: migrate extension from raw Vite to WXT for cross-browser support
8eceb005 feat: add OAuth profile fetchers for Google, LinkedIn, Facebook, Twitter
4ff5e863 feat: add OAuth repository with tests (find, create, delete, count)
bff52033 feat: add OAuth Zod schemas and TypeScript types
f164456c feat: add OAuth config with conditional Arctic provider instances
0537c960 feat: add oauth_accounts table and make password_hash nullable
c755dabd feat: install arctic OAuth library
16116c24 fix: resolve lint and type issues from referrals implementation
2a9f57d5 feat: add Referrals links to app nav and footer
33574694 feat: add /referrals page with auth-conditional rendering
8ea0014f feat: add InfluencerSubmission component
8ca1b86a feat: add ReferralCard component with clipboard and stats display
3cf4d179 feat: pass referral code from register page to backend
27b0cfba feat: add referrals API client
a062f6e3 feat: add verify-post and influencer-history routes
2e48df13 feat: add verifyPost and getInfluencerHistory handlers
a76a6483 feat: award referral credits on registration with valid ref code
b36fd64c feat: add credit-awarding functions to referrals repository
7788f6b6 feat: add LinkedIn post verifier service
853d3a63 feat: add influencerSubmissions repository
a512136e feat: add Zod schemas for referral endpoints
c6cf51dc feat: add influencer_submissions migration
fd17d9f8 fix: resolve TypeScript namespace error for ioredis ESM import in rate limiter
dae33cec feat: integrate PublicGenerator component into landing page between How It Works and Voice Profile Preview
84d37ec7 feat: add PublicGenerator component with idle, loading, result, and exhausted states
198b5395 feat: add API client for public generate endpoint
52458772 feat: mount public generate route at POST /api/public/generate
67b70704 feat: add public generate handler with parallel Claude calls and anti-slop processing
7c7d126d feat: add Redis-backed rate limiter middleware with burst and daily caps
4fc6c138 feat: add generic and public Doppelscript prompt builders to contentGenerator
631e6005 feat: add Zod schema for public generate endpoint
3c8ca7f6 chore: add ioredis dependency for Redis rate limiter
86d1cea9 fix: resolve TypeScript errors in credit system for Railway build
4c9e7520 chore: fix remaining references to subscription system, run full test suite
7a7f75fe refactor: replace subscription UI in settings with credit balance display and link
05ef64ed refactor: replace subscription pricing table with credit pack display
6d57a23f feat: show credit purchase modal when generation fails due to insufficient credits
3a7afe2c feat: show credit balance in AppNav for desktop and mobile
e8c9d6b6 feat: add /app/credits page with balance display, purchase button, and transaction history
edba8f25 fix: make lefthook install non-fatal in Docker builds
487c6be2 feat: add CreditPurchaseModal with three pack options and Stripe Checkout redirect
cedd2ba6 feat: add CreditBalance component with color states and pulse animation
696a5766 feat: add frontend API client for credit balance, purchase, and history
1b90644c fix: update em dash tests for unconditional stripping
a23cb0a9 refactor: mount credits router, remove subscription payments router and files
cd36e590 feat: seed 5 free credits on user registration
8bd8f637 refactor: replace subscription tier check with atomic credit deduction in generation handler
08785b6d refactor: replace subscription webhook with credit purchase webhook (idempotent)
d3ecadf6 feat: add /api/credits routes for balance, purchase, and history
3322478c refactor: add getStripeCustomerId and setStripeCustomerId to users repo
1a16a9ed feat: add credits handler with purchase, balance, and history endpoints
a8066f88 feat: add credit pack Zod schemas with starter, builder, creator packs
913fc435 feat: add credits repository with atomic deduct, add, and history queries
dd45a8f2 feat: add credit system database migrations
d483e73f fix: resolve pre-existing TypeScript errors in platform clients
34056599 feat: brand overhaul, SEO infrastructure, and implementation specs
fd25edee feat: integrate platform connect cards and import flow into voice profile page
48ad2e73 feat: add ImportModal with platform selection, progress polling, and diff review
fa9d75bd feat: add RuleDiff component for proposed change review
05a02d78 feat: add PlatformConnectCard component
58a2596c feat: add frontend API client for platform import
4d1ac1db feat: mount platform import routes
a47be852 feat: add platform import handlers for OAuth, sync, diff, and apply
2f204c55 feat: add BullMQ platform import worker with fetch-analyze-merge pipeline
eac64292 feat: add platform merger for profile diff computation and change application
70448161 feat: add platform-aware post analyzer with cross-platform pattern detection
bf9bc749 feat: add LinkedIn OAuth client (identity only, no post fetch)
fcb2ba2b feat: add Medium RSS platform client
e79cdced feat: add Substack RSS platform client
fe38107c feat: add Twitter/X platform client for post fetching
7dd8b74c feat: add shared types for platform client interfaces
4a3ad9fd feat: add platforms repository for connections, posts, and syncs
b0743c20 feat: add Zod schemas for platform import endpoints
5b806c3b feat: add platform import database migrations
1915abb3 feat: add platform config and OAuth env vars
607464f2 feat: add AES-256-GCM token encryption for OAuth tokens
91343ba3 chore: add .worktrees/ to gitignore
09474c34 docs: add platform import implementation plan
8ae5c8de docs: add platform import (OAuth direct pull) design spec
dd64ce54 fix: resolve build issues, fix test mocks, add pre-build validation spec
ea48f591 test(frontend): add component and API client tests
a3fe581d test: expand service tests and add schema validation tests
4549876d refactor(arch): extract upload repo, consolidate corpus analyzer, fix sourceType bug
089a5c1e fix(security): sanitize R2 filenames, strengthen referral codes, rate limit payments
23d1d972 refactor(generate): implement 3-screen flow (Input -> Editor -> Result)
f4ecb819 feat(frontend): add referral program UI to settings page
7ef03631 feat(frontend): add global error boundary and app loading skeleton
94e7d264 chore: finalize Doppelscript V1 -- ready for beta
546941bd feat(worker): add BullMQ corpus analysis worker with document extraction
a2d7e941 feat(extractors): add PDF and DOCX text extraction
3ad0c320 feat(frontend): add multipart upload and corpus status API functions
be29f14f feat(corpus): add corpus analyzer service with batching pipeline
64902685 docs: add universal 3-screen generation flow to spec
0a9e45f9 fix(frontend): add loading states, error handling, and responsive polish
76b1625b feat(frontend): replace radio-button traits with range slider duality axes
6fbc39c5 feat(referrals): add referral system with code generation and tracking
bad4e102 feat(marketing): add splash page with animated logo and product sections
4285c2fc refactor(tests): update trait fixtures from enum to numeric slider format
69a90066 feat(extension): add Chrome extension with article repurposing
bc98db94 docs: add corpus upload & analysis pipeline implementation plan
4ad7cd52 feat(frontend): add corpus upload page with progress tracking
2f03378e feat(corpus): add upload handler with R2 storage and subscription checks
4a83c984 feat(corpus): add BullMQ analysis worker with full pipeline
9114bb6e feat(corpus): add multi-format corpus parsers with tests
ee6cf47b feat(corpus): add R2 config and upload dependencies
8a46c4b9 feat(frontend): add settings page with subscription management
b172b4a8 feat(frontend): add pricing page with tier comparison
0c70743f feat(frontend): add payment API client
90941fd1 feat(payments): add Stripe webhook handler for subscription lifecycle
c3b815f3 feat(payments): add checkout, portal, and subscription handlers
bb97cd23 feat(payments): add Stripe config and subscription repo functions
ad412963 feat(frontend): add app navigation with Doppelscript wordmark
a3f34374 feat(frontend): add content generation page with form, result, and copy
214bba39 feat(frontend): add generation API client
c366d042 feat(generate): add generation handlers, routes, and subscription checks
adb23205 feat(users): add subscription query helpers
26c786bc feat(generate): add generation schemas and repository
ef01b656 test: add voice profile integration test and final S2 cleanup
fe2b2cba feat(frontend): add voice profile detail page with rules editor
add37357 feat(frontend): add paste-in samples analysis flow
f983cf85 feat(frontend): add trait selector wizard for voice creation
d466db1f feat(frontend): add voice profile API client and dashboard list
94b2dd76 feat(voices): add voice profile handlers and routes
d3ab92da feat(voices): add paste-in analyzer service
863dcb71 feat(voices): add trait compiler service
fa43a8db feat(voices): add voice profile schemas and repository
cb361b71 chore: final cleanup -- lint, format, build, tests pass
35951a46 fix: resolve issues found during end-to-end verification
84b353ed docs: add CLAUDE.md, ISSUES.md, and .env.example files
c0d54f1d docs: move build plan to docs/superpowers/specs/
e8f235a7 chore: add bottomless margaritas hardening (eslint, prettier, lefthook, CI)
a47b1590 feat(db): add Doppelscript schema (voice profiles, corpus uploads, traits, generations)
8b9abea9 chore: strip domain-specific frontend code, remove VibeLens
046ab3ae chore: strip domain-specific code from template (keep auth + middleware)
c5212ebd chore: initialize doppelscript from template-express-next
```
