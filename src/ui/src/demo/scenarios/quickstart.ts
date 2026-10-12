import type { FeedItem, QuestSummary } from '@/types'

import type {
  TutorialDemoExplorerFile,
  TutorialDemoGraphNode,
  TutorialDemoMemoryEntry,
  TutorialDemoScenario,
  TutorialDemoStage,
} from '@/demo/types'

function makeNode(
  node: Omit<TutorialDemoGraphNode, 'state'> & {
    state?: TutorialDemoGraphNode['state']
  }
): TutorialDemoGraphNode {
  return {
    ...node,
    state: node.state ?? 'pending',
  }
}

const DEMO_GRAPH_BLUEPRINT: TutorialDemoGraphNode[] = [
  makeNode({
    id: 'baseline',
    title: 'Confirmed baseline',
    subtitle: 'mandela-effect-official · gpt-oss-120b-dual-sglang',
    kind: 'baseline',
    x: 56,
    y: 380,
    metric: '0.5913',
    note: 'This is the trusted anchor that all later branches are compared against.',
    relatedFileId: 'metric-contract',
    diffId: 'diff-main-result',
    detailMarkdown: `### Confirmed baseline

- **Baseline**: \`mandela-effect-official / gpt-oss-120b-dual-sglang\`
- **Primary metric**: \`maximal_reality_shift_rate = 0.5913\`
- **Meaning**: every later branch should be judged against this anchor before calling a change real.

This node matters because it keeps the whole workspace honest. Without a trusted baseline, every later branch would be hard to interpret.
`,
  }),
  makeNode({
    id: 'idea-a',
    title: 'Debate-only safeguard',
    subtitle: 'fast branch · rejected',
    kind: 'idea',
    x: 344,
    y: 44,
    note: 'Too generic. It increased resistance in one slice, but collapsed into repetitive skepticism.',
    relatedFileId: 'candidates',
    diffId: 'diff-idea-selection',
    detailMarkdown: `### Debate-only safeguard

This branch looked attractive at first because it was cheap and simple. But after inspection, it behaved too much like a generic “argue harder” defense.

Why it lost:
- weak novelty boundary
- too easy to collapse into blanket skepticism
- not specific enough to the benchmark failure surface
`,
  }),
  makeNode({
    id: 'idea-b',
    title: 'Self-knowledge split',
    subtitle: 'narrow pilot · partial gain',
    kind: 'idea',
    x: 344,
    y: 188,
    note: 'Useful signal, but the gain did not generalize well across the full task surface.',
    relatedFileId: 'candidates',
    diffId: 'diff-idea-selection',
    detailMarkdown: `### Self-knowledge split

This branch preserved some of the agent's private anchor before social exposure, and it did recover signal on a narrower slice.

Why it did not win:
- the local gain was real
- but it did not generalize well enough
- the full story was still weaker than the later confidence-calibrated route
`,
  }),
  makeNode({
    id: 'idea-c',
    title: 'Confidence-calibrated provenance memory',
    subtitle: 'selected direction · main line',
    kind: 'idea',
    x: 344,
    y: 336,
    note: 'Best match between failure analysis, intervention clarity, and measurable upside.',
    relatedFileId: 'selected-idea',
    diffId: 'diff-idea-selection',
    detailMarkdown: `### Confidence-calibrated provenance memory

This became the main direction because it made social learning **selective** rather than simply more defensive.

Core mechanism:
- separate self-knowledge, peer claims, and support provenance
- preserve uncertainty instead of flattening all social evidence into one summary
- calibrate promotion and retrieval by confidence
`,
  }),
  makeNode({
    id: 'idea-d',
    title: 'Evidence-type retrieval gate',
    subtitle: 'hard filter branch · mixed',
    kind: 'idea',
    x: 344,
    y: 486,
    note: 'Useful for noisy reports, but too blunt when valid peer evidence should still move the agent.',
    relatedFileId: 'candidates',
    diffId: 'diff-idea-selection',
    detailMarkdown: `### Evidence-type retrieval gate

This branch only promoted memory when the evidence type looked strong enough.

It was valuable because it sharpened the later design, but on its own it was still too rigid:
- good at blocking noise
- weak at preserving nuanced partial evidence
`,
  }),
  makeNode({
    id: 'idea-e',
    title: 'Contradiction trace buffer',
    subtitle: 'inspection-heavy · retired',
    kind: 'idea',
    x: 344,
    y: 638,
    note: 'Helpful for interpretability, but too expensive and too slow as the main route.',
    relatedFileId: 'candidates',
    diffId: 'diff-idea-selection',
    detailMarkdown: `### Contradiction trace buffer

This idea preserved a richer trace of conflicting evidence.

Why it was retired:
- useful for later analysis
- too expensive as the primary default memory route
- better as a supporting analysis pattern than a main branch
`,
  }),
  makeNode({
    id: 'run-pilot',
    title: 'Pilot run',
    subtitle: '6-task subset · signal found',
    kind: 'experiment',
    x: 696,
    y: 36,
    metric: '0.4412',
    note: 'A smaller run showed real movement, enough to justify scaling up.',
    relatedFileId: 'run-pilot-result',
    diffId: 'diff-main-result',
    detailMarkdown: `### Pilot run

The pilot answered one question: **is the mechanism real enough to justify a larger run?**

Observed signal:
- aggregate metric improved on the subset
- one ablation already showed what breaks the gain
- local regressions still existed, so the branch was promising but not claim-ready
`,
  }),
  makeNode({
    id: 'run-ood-scout',
    title: 'OOD scout run',
    subtitle: 'held-out slice · mixed',
    kind: 'experiment',
    x: 696,
    y: 154,
    metric: '0.3984',
    note: 'The direction transferred to held-out slices, but the gain was uneven and still fragile.',
    relatedFileId: 'comparison-report',
    diffId: 'diff-main-result',
    detailMarkdown: `### OOD scout run

This branch checked whether the signal survived beyond the easiest subset.

What it taught:
- the direction was not purely overfit
- transfer existed, but still with uneven task-level behavior
`,
  }),
  makeNode({
    id: 'run-latency',
    title: 'Latency stress test',
    subtitle: 'queue pressure · failed',
    kind: 'experiment',
    x: 696,
    y: 272,
    metric: '0.4630',
    note: 'The branch stayed accurate enough, but the latency overhead was too high for the default route.',
    relatedFileId: 'run',
    diffId: 'diff-ablation-failure',
    detailMarkdown: `### Latency stress test

This run mattered because a route can be correct but still unusable in practice.

Result:
- quality stayed acceptable
- latency and tool pressure became too high
`,
  }),
  makeNode({
    id: 'run-ablation',
    title: 'Ablation branch',
    subtitle: 'write-only memory · failed',
    kind: 'experiment',
    x: 696,
    y: 390,
    metric: '0.5098',
    note: 'Removing retrieval calibration erased most of the gain.',
    relatedFileId: 'run-ablation-result',
    diffId: 'diff-ablation-failure',
    detailMarkdown: `### Ablation branch

This failed branch is important because it explains **why** the main route worked.

Takeaway:
- keeping memory writes alone was not enough
- removing retrieval calibration erased most of the gain
- the branch still matters because it narrows the mechanism story
`,
  }),
  makeNode({
    id: 'run-no-confidence',
    title: 'No-confidence ablation',
    subtitle: 'confidence removed · failed',
    kind: 'experiment',
    x: 696,
    y: 508,
    metric: '0.5341',
    note: 'Without confidence, useful memory and noisy memory were promoted together and the branch regressed fast.',
    relatedFileId: 'comparison-report',
    diffId: 'diff-ablation-failure',
    detailMarkdown: `### No-confidence ablation

This branch dropped confidence weighting but preserved provenance tags.

What failed:
- weak evidence and strong evidence started to look too similar
- memory promotion became too permissive
`,
  }),
  makeNode({
    id: 'run-no-source-tags',
    title: 'No-source-tags ablation',
    subtitle: 'provenance removed · weak',
    kind: 'experiment',
    x: 696,
    y: 626,
    metric: '0.4877',
    note: 'The branch kept calibration but lost source identity, which made later retrieval much less trustworthy.',
    relatedFileId: 'comparison-report',
    diffId: 'diff-ablation-failure',
    detailMarkdown: `### No-source-tags ablation

This branch asked whether calibration alone could carry the route.

It could not:
- retrieval still happened
- but the agent lost the ability to judge where the evidence came from
`,
  }),
  makeNode({
    id: 'run-main',
    title: 'Main experiment',
    subtitle: 'full MANBENCH sweep',
    kind: 'experiment',
    x: 1056,
    y: 268,
    metric: '0.1905',
    note: 'This is the main success node: a strong aggregate improvement over the baseline.',
    relatedFileId: 'result',
    diffId: 'diff-main-result',
    detailMarkdown: `### Main experiment

This is the strongest result in the workspace.

Headline:
- current \`maximal_reality_shift_rate = 0.1905\`
- baseline \`= 0.5913\`
- delta vs baseline \`= -0.4008\`

Interpretation:
- the route is now strong enough to justify analysis and writing
- but not strong enough to skip task-level claim-boundary checks
`,
  }),
  makeNode({
    id: 'run-memory-budget',
    title: 'Memory budget sweep',
    subtitle: 'capacity curve · useful',
    kind: 'experiment',
    x: 1056,
    y: 500,
    metric: '0.2318',
    note: 'A larger budget helped a little, but the main gain did not depend on simply storing more tokens.',
    relatedFileId: 'comparison-report',
    diffId: 'diff-main-result',
    detailMarkdown: `### Memory budget sweep

This branch checked whether the gain came from **better memory structure** or merely **more memory**.

Conclusion:
- more budget helped slightly
- but structure was still the main driver
`,
  }),
  makeNode({
    id: 'analysis-cluster',
    title: 'Error-cluster analysis',
    subtitle: 'cluster map · durable',
    kind: 'analysis',
    x: 1420,
    y: 92,
    note: 'The aggregate win held, but error clusters were still concentrated in a few interpretable regions.',
    relatedFileId: 'comparison-report',
    diffId: 'diff-claim-boundary',
    detailMarkdown: `### Error-cluster analysis

This node groups the remaining failures so the team can talk about them concretely instead of vaguely.

Most persistent clusters:
- causal judgment
- known unknowns
- language identification
`,
  }),
  makeNode({
    id: 'analysis-ood',
    title: 'OOD boundary analysis',
    subtitle: 'held-out behavior · bounded',
    kind: 'analysis',
    x: 1420,
    y: 244,
    note: 'The method still improved on held-out slices, but the safe claim had to stay narrower than the aggregate curve suggested.',
    relatedFileId: 'claim-boundary',
    diffId: 'diff-claim-boundary',
    detailMarkdown: `### OOD boundary analysis

This branch turns “it looks promising” into a paper-safe statement.

The key job here is not to oversell transfer beyond what the evidence can support.
`,
  }),
  makeNode({
    id: 'analysis-boundary',
    title: 'Claim-boundary analysis',
    subtitle: 'paper-safe limits · current',
    kind: 'analysis',
    x: 1420,
    y: 398,
    note: 'The aggregate result is strong, but a paper still needs trustworthy limits.',
    relatedFileId: 'route-decision',
    diffId: 'diff-claim-boundary',
    detailMarkdown: `### Claim-boundary analysis

This node exists so the paper does not overstate what the method fixed.

Main question:
- where does the aggregate result genuinely hold?
- where do local regressions still limit the claim?
`,
  }),
  makeNode({
    id: 'write-outline',
    title: 'Paper outline',
    subtitle: 'outline-first writing branch',
    kind: 'writing',
    x: 1420,
    y: 552,
    note: 'Writing starts once the main claim is stable enough to be framed and bounded.',
    relatedFileId: 'outline',
    diffId: 'diff-paper-outline',
    detailMarkdown: `### Paper outline

Writing begins after the result is strong enough and the claim boundary is explicit enough.

What this branch is for:
- turn runs into paper structure
- preserve evidence paths
- make later revision and rebuttal easier
`,
  }),
  makeNode({
    id: 'write-figures',
    title: 'Figure story pass',
    subtitle: 'chart + appendix plan',
    kind: 'writing',
    x: 1420,
    y: 702,
    note: 'The figure branch decides which comparisons deserve to become durable visual evidence.',
    relatedFileId: 'comparison-report',
    diffId: 'diff-paper-outline',
    detailMarkdown: `### Figure story pass

This branch is where raw results turn into narrative evidence:
- which chart belongs in the main paper
- which ablation moves to appendix
- which negative result is still worth showing
`,
  }),
  makeNode({
    id: 'write-rebuttal',
    title: 'Rebuttal scaffold',
    subtitle: 'review-aware draft',
    kind: 'writing',
    x: 1788,
    y: 476,
    note: 'The workspace already stores enough branch evidence that rebuttal preparation can begin before reviews arrive.',
    relatedFileId: 'route-decision',
    diffId: 'diff-paper-outline',
    detailMarkdown: `### Rebuttal scaffold

This branch exists early because strong projects keep their evidence organized for later review pressure.

It is where:
- ablations stay reusable
- reviewer questions become mapped experiments
- writing stays synchronized with real artifacts
`,
  }),
  makeNode({
    id: 'decision-route',
    title: 'Route decision',
    subtitle: 'analysis deeper or draft now',
    kind: 'decision',
    x: 1788,
    y: 294,
    note: 'A durable routing point after the main result is locked.',
    relatedFileId: 'claim-map',
    diffId: 'diff-paper-outline',
    detailMarkdown: `### Route decision

This is the point where human collaboration matters most.

Typical choices:
- deepen analysis before drafting
- move directly into writing
- reopen experimentation only if a real claim blocker still exists
`,
  }),
  makeNode({
    id: 'decision-figure',
    title: 'Figure gate',
    subtitle: 'which plots are publication-ready',
    kind: 'decision',
    x: 1788,
    y: 642,
    note: 'Some figures are exploratory only; this node records which ones are strong enough for the main paper.',
    relatedFileId: 'claim-map',
    diffId: 'diff-paper-outline',
    detailMarkdown: `### Figure gate

This decision records which visual artifacts are mature enough for paper-facing use and which should remain internal.
`,
  }),
  makeNode({
    id: 'decision-submit',
    title: 'Submission handoff',
    subtitle: 'paper package · pending',
    kind: 'decision',
    x: 2144,
    y: 470,
    note: 'The final node collects the current evidence, writing state, and remaining risks before submission.',
    relatedFileId: 'route-decision',
    diffId: 'diff-paper-outline',
    detailMarkdown: `### Submission handoff

This is the final packaging point:
- claims
- limitations
- figures
- rebuttal readiness
- outstanding risks
`,
  }),
]

const GRAPH_NODE_IDS = DEMO_GRAPH_BLUEPRINT.map((node) => node.id)
const IDEA_NODE_IDS = ['idea-a', 'idea-b', 'idea-c', 'idea-d', 'idea-e']
const PILOT_NODE_IDS = ['run-pilot', 'run-ood-scout', 'run-latency', 'run-ablation', 'run-no-confidence', 'run-no-source-tags']
const MAIN_NODE_IDS = ['run-main', 'run-memory-budget']
const ANALYSIS_NODE_IDS = ['analysis-cluster', 'analysis-ood', 'analysis-boundary']
const WRITE_NODE_IDS = ['write-outline', 'write-figures', 'write-rebuttal', 'decision-route', 'decision-figure', 'decision-submit']
const IDEA_STAGE_NODE_IDS = ['baseline', ...IDEA_NODE_IDS]
const PILOT_STAGE_NODE_IDS = [...IDEA_STAGE_NODE_IDS, ...PILOT_NODE_IDS]
const MAIN_STAGE_NODE_IDS = [...PILOT_STAGE_NODE_IDS, ...MAIN_NODE_IDS]
const ANALYSIS_STAGE_NODE_IDS = [...MAIN_STAGE_NODE_IDS, ...ANALYSIS_NODE_IDS]
const WRITE_STAGE_NODE_IDS = [...ANALYSIS_STAGE_NODE_IDS, ...WRITE_NODE_IDS]

function withGraphStates(overrides: Partial<Record<string, TutorialDemoGraphNode['state']>>) {
  const next = Object.fromEntries(
    GRAPH_NODE_IDS.map((nodeId) => [nodeId, 'pending' satisfies TutorialDemoGraphNode['state']])
  ) as Record<string, TutorialDemoGraphNode['state']>
  Object.entries(overrides).forEach(([nodeId, state]) => {
    if (state) {
      next[nodeId] = state
    }
  })
  return next
}

function makeGraphNodes(stateMap: Record<string, TutorialDemoGraphNode['state']>, currentNodeId: string) {
  return DEMO_GRAPH_BLUEPRINT.map((node) => ({
    ...node,
    note:
      node.id === 'decision-route' && currentNodeId === 'decision-route'
        ? 'This is the current handoff point: the workspace is waiting for a clear next-route choice.'
        : node.id === 'decision-submit' && currentNodeId === 'decision-submit'
          ? 'This is the last checkpoint before packaging the paper, figures, and rebuttal evidence.'
          : node.note,
    state: stateMap[node.id] ?? node.state,
  }))
}

function makeOperation(args: {
  id: string
  createdAt: string
  label: 'tool_call' | 'tool_result'
  status?: string
  args?: string
  output?: string
  subject?: string
}) {
  return {
    id: args.id,
    type: 'operation',
    label: args.label,
    toolName: 'bash_exec',
    toolCallId: args.id,
    status: args.status,
    args: args.args,
    output: args.output,
    content: 'bash_exec',
    createdAt: args.createdAt,
    subject: args.subject,
  } as FeedItem
}

function makeArtifact(args: {
  id: string
  kind: string
  content: string
  createdAt: string
  status?: string
}) {
  return {
    id: args.id,
    type: 'artifact',
    kind: args.kind,
    content: args.content,
    status: args.status,
    createdAt: args.createdAt,
  } as FeedItem
}

const explorerFiles: TutorialDemoExplorerFile[] = [
  {
    id: 'brief',
    group: 'Quest root',
    name: 'brief.md',
    path: 'brief.md',
    content: `# Brief

## Project goal

Reproduce the confirmed Memory baseline, isolate why collaborative truth distortion pushes the model away from stable self-knowledge, and test one stronger memory intervention that remains prompt-level and easy to compare.

## Working question

Can a confidence-calibrated provenance memory reduce \`maximal_reality_shift_rate\` without collapsing into blanket skepticism or losing useful social evidence?

## Success criteria

- a trustworthy reproduced baseline
- at least one promoted idea branch with a measurable win
- durable logs, task-level deltas, and a bounded conclusion

## Constraints

- keep the intervention lightweight and inspectable
- preserve task-level evidence, not only one scalar metric
- avoid claiming global robustness before regression clusters are analyzed
`,
  },
  {
    id: 'status',
    group: 'Quest root',
    name: 'status.md',
    path: 'status.md',
    content: `# Status

- Anchor: decision
- Current branch: run/ccpm-memory-map
- Accepted baseline: mandela-effect-official / gpt-oss-120b-dual-sglang
- Latest headline metric: maximal_reality_shift_rate = 0.1905
- Delta vs baseline: -0.4008
- Connector: QQ thread bound and receiving milestone summaries
- Next route: analysis or outline-first writing

## Current decision

The main run is strong enough to justify writing, but the paper claim must stay bounded by the remaining regression clusters before it is treated as submission-ready.
`,
  },
  {
    id: 'summary',
    group: 'Quest root',
    name: 'SUMMARY.md',
    path: 'SUMMARY.md',
    content: `# Summary

This project started from a confirmed baseline and expanded into a multi-branch research map.

The winning route, **Confidence-Calibrated Provenance Memory**, now beats the baseline aggregate on the full MANBENCH sweep:

- baseline: \`0.5913\`
- current main run: \`0.1905\`
- delta vs baseline: \`-0.4008\`

The branch is promising enough for paper preparation, but the final claim still needs to acknowledge localized regressions in \`causal_judgment\`, \`known_unknowns\`, and \`language_identification\`.
`,
  },
  {
    id: 'plan',
    group: 'Quest root',
    name: 'plan.md',
    path: 'plan.md',
    content: `# Plan

1. Confirm the baseline and metric contract
2. Read related work and write down multiple candidate ideas
3. Select one idea that best matches the failure surface
4. Run a pilot plus at least one informative ablation
5. Launch the full MANBENCH main run
6. Compare wins and regressions task by task
7. Bound the claim and update durable memory
8. Prepare the outline, figures, and rebuttal-ready evidence
`,
  },
  {
    id: 'quest-yaml',
    group: 'Quest root',
    name: 'quest.yaml',
    path: 'quest.yaml',
    content: `quest_id: "025"
title: "Memory"
branch: "run/ccpm-memory-map"
status: "running"
runner: "codex"
baseline_gate: "confirmed"
active_baseline_id: "mandela-effect-official"
active_baseline_variant_id: "gpt-oss-120b-dual-sglang"
connector_bindings:
  - connector: "qq"
    conversation_id: "qq:direct:demo-memory::thread-001"
`,
  },
  {
    id: 'candidates',
    group: 'Ideas',
    name: 'candidates.md',
    path: 'artifacts/idea/candidates.md',
    content: `# Candidate Directions

## Shortlist

1. **Debate-only safeguard**
   - force harder disagreement before accepting peer claims
   - cheap, but risks collapsing into generic refusal

2. **Self-knowledge split**
   - preserve an internal anchor before social exposure
   - useful signal, but weaker transfer

3. **Confidence-calibrated provenance memory**
   - track claim source, support type, and confidence separately
   - best alignment with the observed failure surface

4. **Evidence-type retrieval gate**
   - promote only high-confidence evidence types
   - sharpens retrieval, but may be too rigid

5. **Contradiction trace buffer**
   - keep a heavier audit trail of disagreement
   - good for analysis, too expensive as the main path
`,
  },
  {
    id: 'literature-notes',
    group: 'Ideas',
    name: 'literature_notes.md',
    path: 'artifacts/idea/literature_notes.md',
    content: `# Literature Notes

## Recurrent pattern

Across related memory and debate papers, the common failure mode is not only weak retrieval. It is often **undifferentiated evidence aggregation**:

- self-knowledge and peer claims are merged too early
- weak evidence and strong evidence are promoted together
- later retrieval loses source identity and confidence

## Implication for this project

The next branch should not merely “argue harder.” It should preserve:

1. who supplied the evidence
2. how trustworthy the evidence was
3. whether the model itself already had a stable internal anchor
`,
  },
  {
    id: 'selection-rationale',
    group: 'Ideas',
    name: 'selection_rationale.md',
    path: 'artifacts/idea/selection_rationale.md',
    content: `# Selection Rationale

The selected route won because it offers a causal mechanism that is both prompt-level and experimentally legible.

## Why the winning idea was promoted

- It preserves source identity instead of flattening all claims into one memory blob.
- It preserves uncertainty instead of overcorrecting into refusal.
- It directly targets the observed benchmark pathology: social evidence corrupts internal certainty too early.

## Why the others lost

- Debate-only safeguard: too generic
- Self-knowledge split: useful, but not strong enough
- Evidence-type gate: too rigid when good peer evidence should still move the model
- Contradiction trace buffer: expensive and better as analysis support
`,
  },
  {
    id: 'selected-idea',
    group: 'Ideas',
    name: 'selected_idea.md',
    path: 'artifacts/idea/selected_idea.md',
    content: `# Selected Idea

## Confidence-Calibrated Provenance Memory

The branch separates:

- self-knowledge
- peer claims
- support provenance
- confidence of promotion

### Expected effect

The model should keep learning from correct collaborators, but it should stop treating every incoming social signal as equally trustworthy.

### Main hypothesis

If memory writes and retrieval are both calibrated by provenance-aware confidence, then aggregate truth-preserving collaboration should improve without turning the model into a blanket skeptic.
`,
  },
  {
    id: 'baseline-note',
    group: 'Baseline',
    name: 'baseline_note.md',
    path: 'baselines/local/Mandela-Effect/baseline_note.md',
    content: `# Baseline Note

- status: confirmed
- purpose: anchor all later comparisons
- benchmark: MANBENCH
- model variant: gpt-oss-120b-dual-sglang
- primary metric: maximal_reality_shift_rate
- interpretation rule: lower is better

## Reuse policy

Do not promote a new branch unless it beats this baseline on the same metric contract and task definition.
`,
  },
  {
    id: 'metric-contract',
    group: 'Baseline',
    name: 'metric_contract.json',
    path: 'baselines/local/Mandela-Effect/json/metric_contract.json',
    content: `{
  "primary_metric_id": "maximal_reality_shift_rate",
  "direction": "minimize",
  "label": "maximal_reality_shift_rate",
  "decimals": 4,
  "compare_against": "confirmed_baseline",
  "paper_safe": false
}`,
  },
  {
    id: 'baseline-result',
    group: 'Baseline',
    name: 'RESULT.json',
    path: 'baselines/local/Mandela-Effect/output/gpt_oss_120b_full/RESULT.json',
    content: `{
  "metric": "maximal_reality_shift_rate",
  "value": 0.5913,
  "verdict": "trusted baseline",
  "next_route": "idea selection",
  "tasks_evaluated": 20,
  "benchmark": "MANBENCH"
}`,
  },
  {
    id: 'bindings',
    group: 'Connector',
    name: 'bindings.json',
    path: '.ds/bindings.json',
    content: `{
  "bindings": [
    {
      "connector": "qq",
      "conversation_id": "qq:direct:demo-memory::thread-001",
      "status": "active",
      "delivery_mode": "threaded"
    }
  ]
}`,
  },
  {
    id: 'connector-delivery',
    group: 'Connector',
    name: 'latest_delivery.md',
    path: 'artifacts/progress/latest_delivery.md',
    content: `# Latest Connector Delivery

- connector: qq
- target: demo-memory thread
- latest event: main milestone delivered
- reply mode: threaded

## Last message summary

The full run beat the confirmed baseline with a large aggregate margin. The next recommendation sent outside the workspace was: **bound the claim before overclaiming in writing**.
`,
  },
  {
    id: 'connector-thread-note',
    group: 'Connector',
    name: 'qq_thread_summary.md',
    path: '.ds/connector_messages/qq_thread_summary.md',
    content: `# QQ Thread Summary

## Delivered checkpoints

1. Baseline confirmed
2. Selected idea promoted
3. Pilot gain + failed ablation note
4. Main run milestone
5. Claim-boundary warning
6. Outline-first writing handoff
`,
  },
  {
    id: 'idea',
    group: 'Memory',
    name: 'idea.md',
    path: 'memory/ideas/idea-969ae84f/idea.md',
    content: `# Confidence-Calibrated Provenance Memory

## Design notes

Keep self-knowledge, peer claims, and evidence strength separated in both write and retrieval paths.

## Draft rules

- preserve a private anchor when it is still well-supported
- record source identity instead of flattening provenance
- promote weak claims only under explicit confidence gating
- allow strong peer evidence to move the model when support is genuine
`,
  },
  {
    id: 'active-user-requirements',
    group: 'Memory',
    name: 'active-user-requirements.md',
    path: 'memory/knowledge/active-user-requirements.md',
    content: `# Active User Requirements

- Goal: improve truth-preserving collaboration under mixed social signals
- Preference: discriminative robustness rather than blanket refusal
- Constraint: prompt/system-level route, not heavyweight architecture changes
- Deliverable: evidence strong enough for a bounded paper claim
`,
  },
  {
    id: 'failure-taxonomy',
    group: 'Memory',
    name: 'failure-taxonomy.md',
    path: 'memory/knowledge/failure-taxonomy.md',
    content: `# Failure Taxonomy

## Persistent clusters

1. **causal_judgment**
   - model over-updates on socially plausible but weakly grounded causal stories

2. **known_unknowns**
   - uncertainty collapses too early when peer evidence sounds fluent

3. **language_identification**
   - retrieval of weak cues can still overpower strong internal anchors
`,
  },
  {
    id: 'speaker-reliability',
    group: 'Memory',
    name: 'speaker_reliability.md',
    path: 'memory/knowledge/speaker_reliability.md',
    content: `# Speaker Reliability Notes

The branch should not use a single global speaker score. Reliability changes with:

- task type
- evidence form
- whether the claim agrees with an already stable internal anchor

This note is a reminder that provenance is contextual, not just identity-based.
`,
  },
  {
    id: 'claim-boundary',
    group: 'Memory',
    name: 'claim-boundary.md',
    path: 'memory/knowledge/claim-boundary.md',
    content: `# Claim Boundary

The route clearly beats the baseline in aggregate, but the paper should not claim uniform improvement.

## Bound the statement with

- causal_judgment regressions
- known_unknowns regressions
- language_identification regressions

## Safe wording

The method improves truth-preserving collaboration overall, while still showing localized failures under several interpretable task clusters.
`,
  },
  {
    id: 'route-decision',
    group: 'Memory',
    name: 'route-decision.md',
    path: 'memory/decisions/route-decision.md',
    content: `# Route Decision

The main result is strong enough to support outline-first writing, but not strong enough to skip targeted regression analysis.

## Decision

- keep the global claim
- keep the writing branch moving
- do not hide localized failures
- preserve a direct path into rebuttal and revision work
`,
  },
  {
    id: 'compute-allocation',
    group: 'Memory',
    name: 'compute_allocation.md',
    path: 'memory/decisions/compute_allocation.md',
    content: `# Compute Allocation

## Current stance

- do not reopen wide idea search
- reserve most compute for analysis-backed reruns only if a claim blocker appears
- spend writing time in parallel because the result is already meaningful
`,
  },
  {
    id: 'episode',
    group: 'Memory',
    name: 'subset-task-discovery-bug.md',
    path: 'memory/episodes/subset-task-discovery-bug.md',
    content: `# Episode

An earlier smoke looked worse than expected because subset task discovery was broken.

## What actually happened

- the pilot initially appeared weaker than the baseline
- the root cause was not the method
- the task discovery path silently dropped part of the intended subset

## Why it matters

This workspace keeps episodes like this so later routing decisions do not confuse workflow bugs with scientific failure.
`,
  },
  {
    id: 'paper-risks',
    group: 'Memory',
    name: 'reviewer-risk-register.md',
    path: 'memory/papers/reviewer-risk-register.md',
    content: `# Reviewer Risk Register

## Likely reviewer questions

1. Is the gain robust beyond the easiest subset?
2. Does the route simply become more skeptical?
3. Which ablation proves that provenance and confidence both matter?
4. How narrow should the final claim be?
`,
  },
  {
    id: 'figure-story',
    group: 'Memory',
    name: 'figure-story.md',
    path: 'memory/papers/figure-story.md',
    content: `# Figure Story

The main paper should foreground:

- baseline vs main run aggregate improvement
- one compact ablation figure
- one appendix panel for regression clusters

Do not overload the main paper with every failed branch. Show only the failures that clarify the mechanism.
`,
  },
  {
    id: 'pilot-run',
    group: 'Experiments',
    name: 'RUN.md',
    path: 'experiments/pilot/run-0c3e/RUN.md',
    content: `# Pilot RUN

- branch: run/ccpm-pilot
- benchmark: MANBENCH subset
- tasks: 6
- goal: verify that the mechanism is real before paying for a full sweep

## Notes

The pilot should be treated as a promotion gate, not as a publishable result.
`,
  },
  {
    id: 'run-pilot-result',
    group: 'Experiments',
    name: 'RESULT.json',
    path: 'experiments/pilot/run-0c3e/RESULT.json',
    content: `{
  "metric": "maximal_reality_shift_rate",
  "value": 0.4412,
  "baseline": 0.5913,
  "delta_vs_baseline": -0.1501,
  "verdict": "promising pilot signal",
  "tasks_evaluated": 6
}`,
  },
  {
    id: 'pilot-stdout',
    group: 'Experiments',
    name: 'stdout.log',
    path: 'experiments/pilot/run-0c3e/logs/stdout.log',
    content: `[pilot] loading MANBENCH subset: 6 tasks
[pilot] restored baseline comparison target
[pilot] maximal_reality_shift_rate = 0.4412
[pilot] delta_vs_baseline = -0.1501
[pilot] result saved to experiments/pilot/run-0c3e/RESULT.json
`,
  },
  {
    id: 'ablation-run',
    group: 'Experiments',
    name: 'RUN.md',
    path: 'experiments/ablation/run-2f91/RUN.md',
    content: `# Ablation RUN

- branch: ablation/write-only-memory
- removed component: retrieval confidence calibration
- purpose: test whether writing memory alone explains the gain

## Expected interpretation

If the branch regresses sharply, then confidence-aware retrieval is part of the causal story rather than an implementation detail.
`,
  },
  {
    id: 'run-ablation-result',
    group: 'Experiments',
    name: 'RESULT.json',
    path: 'experiments/ablation/run-2f91/RESULT.json',
    content: `{
  "metric": "maximal_reality_shift_rate",
  "value": 0.5098,
  "baseline": 0.5913,
  "delta_vs_baseline": -0.0815,
  "verdict": "memory write alone is not enough"
}`,
  },
  {
    id: 'run',
    group: 'Experiments',
    name: 'RUN.md',
    path: 'experiments/main/run-3f9c5860/RUN.md',
    content: `# Main RUN

- branch: run/ccpm-memory-map
- benchmark: MANBENCH
- sweep: full
- tasks: 20
- result: completed cleanly

## Readout

The full run is the first point where the branch becomes strong enough to justify paper-facing interpretation.
`,
  },
  {
    id: 'result',
    group: 'Experiments',
    name: 'RESULT.json',
    path: 'experiments/main/run-3f9c5860/RESULT.json',
    content: `{
  "metric": "maximal_reality_shift_rate",
  "value": 0.1905,
  "baseline": 0.5913,
  "delta_vs_baseline": -0.4008,
  "verdict": "good",
  "tasks_evaluated": 20
}`,
  },
  {
    id: 'task-breakdown',
    group: 'Experiments',
    name: 'task_breakdown.csv',
    path: 'experiments/main/run-3f9c5860/metrics/task_breakdown.csv',
    content: `task,baseline,current,delta
dyck_languages,0.2457,0.1293,-0.1164
empirical_judgments,0.1296,0.0577,-0.0719
tellmewhy,0.1433,0.0881,-0.0552
causal_judgment,0.2077,0.2910,+0.0833
known_unknowns,0.0238,0.0952,+0.0714
language_identification,0.3318,0.3761,+0.0443
`,
  },
  {
    id: 'comparison-report',
    group: 'Reports',
    name: 'confidence_calibrated_provisional_memory_full_comparison.md',
    path: 'artifacts/reports/confidence_calibrated_provisional_memory_full_comparison.md',
    content: `# Full MANBENCH Comparison

- maximal_reality_shift_rate: 0.1905
- baseline reference: 0.5913
- delta_vs_baseline: -0.4008

## Best gains

- dyck_languages
- empirical_judgments
- tellmewhy

## Still risky

- causal_judgment
- known_unknowns
- language_identification

## Interpretation

The route is strong enough to move into paper preparation, but only if the claim stays bounded by the persistent regression clusters.
`,
  },
  {
    id: 'analysis-claim-boundary',
    group: 'Reports',
    name: 'claim_boundary.md',
    path: 'artifacts/analysis/claim_boundary.md',
    content: `# Claim Boundary Analysis

## Objective

Translate the main run into a paper-safe statement.

## Current answer

The aggregate win is real, but the final paper should describe the method as improving truth-preserving collaboration **overall**, not universally.

## Required caveat

Localized regressions remain in tasks where fluent social evidence can still overpower a stable private anchor.
`,
  },
  {
    id: 'error-cluster-map',
    group: 'Reports',
    name: 'error_cluster_map.md',
    path: 'artifacts/analysis/error_cluster_map.md',
    content: `# Error Cluster Map

## Cluster A: causal_judgment

Peer-provided causal stories are still over-trusted when they sound coherent.

## Cluster B: known_unknowns

The model still overcommits under ambiguous external evidence.

## Cluster C: language_identification

Weak lexical cues can still slip through provenance-aware promotion.
`,
  },
  {
    id: 'outline',
    group: 'Paper',
    name: 'outline.md',
    path: 'paper/outline.md',
    content: `# Outline

1. Failure surface of collaborative truth distortion
2. Confidence-calibrated provenance memory
3. Pilot evidence and informative ablations
4. Main MANBENCH result
5. Claim boundary and regression clusters
6. Figure story and rebuttal-ready assets
`,
  },
  {
    id: 'claim-map',
    group: 'Paper',
    name: 'claim_map.md',
    path: 'paper/claim_map.md',
    content: `# Claim Map

- Main claim: the route improves truth-preserving collaboration under social corruption.
- Boundary: gains are aggregate-strong, but some task clusters still regress locally.
- Mechanism claim: provenance plus confidence both matter; memory writes alone are insufficient.
- Writing rule: do not overclaim beyond the bounded evidence.
`,
  },
  {
    id: 'figure-plan',
    group: 'Paper',
    name: 'figure_plan.md',
    path: 'paper/figures/figure_plan.md',
    content: `# Figure Plan

## Main paper

1. Baseline vs main run aggregate comparison
2. One compact ablation figure showing why confidence and provenance both matter

## Appendix

1. Task-level risk clusters
2. OOD boundary checks
3. Additional failed branches
`,
  },
  {
    id: 'intro-draft',
    group: 'Paper',
    name: 'intro.md',
    path: 'paper/sections/intro.md',
    content: `# Introduction Draft

Collaborative LLM systems benefit from social evidence, but that same evidence can distort truth-preserving reasoning when weak claims are promoted too aggressively.

This project explores whether provenance-aware confidence calibration can keep the benefits of collaboration while reducing socially induced reality shift.
`,
  },
  {
    id: 'rebuttal-checklist',
    group: 'Paper',
    name: 'rebuttal_checklist.md',
    path: 'paper/rebuttal/rebuttal_checklist.md',
    content: `# Rebuttal Checklist

- map each reviewer concern to a branch, run, or memory note
- keep ablation evidence easy to reopen
- preserve claim-boundary language across the paper and response letter
- make sure every new experiment also updates the research map
`,
  },
]

const diffs = [
  {
    id: 'diff-idea-selection',
    title: 'Selected idea branch',
    summary: 'The chosen idea replaces a generic safeguard with a provenance-aware memory route.',
    leftLabel: 'candidates.md',
    rightLabel: 'selected_idea.md',
    patch: `--- artifacts/idea/candidates.md
+++ artifacts/idea/selected_idea.md
@@
- Debate-only safeguard
- Reliability Ledger For Speakers
- Counterfactual Challenge Replay
+ Confidence-calibrated provenance memory
+
+ Why this route won:
+ - keeps social learning selective
+ - preserves source identity
+ - avoids blanket refusal
`,
  },
  {
    id: 'diff-ablation-failure',
    title: 'Ablation result',
    summary: 'The ablation removed retrieval calibration and exposed why the full mechanism mattered.',
    leftLabel: 'pilot result',
    rightLabel: 'ablation result',
    patch: `--- experiments/pilot/run-0c3e/RESULT.json
+++ experiments/ablation/run-2f91/RESULT.json
@@
- "maximal_reality_shift_rate": 0.4412
+ "maximal_reality_shift_rate": 0.5098
@@
- "interpretation": "promising pilot signal"
+ "interpretation": "memory write alone is not enough; retrieval calibration matters"
`,
  },
  {
    id: 'diff-main-result',
    title: 'Main result against baseline',
    summary: 'The full run lands a large aggregate gain against the confirmed baseline.',
    leftLabel: 'baseline',
    rightLabel: 'main result',
    patch: `--- baselines/local/Mandela-Effect/output/gpt_oss_120b_full/RESULT.json
+++ experiments/main/run-3f9c5860/RESULT.json
@@
- "maximal_reality_shift_rate": 0.5913
+ "maximal_reality_shift_rate": 0.1905
@@
- "verdict": "trusted baseline"
+ "verdict": "major aggregate improvement"
@@
- "next_route": "idea selection"
+ "next_route": "analysis or writing"
`,
  },
  {
    id: 'diff-claim-boundary',
    title: 'Claim boundary write-back',
    summary: 'The result is rewritten from a pure win narrative into a bounded claim with explicit regression clusters.',
    leftLabel: 'raw result summary',
    rightLabel: 'claim-boundary note',
    patch: `--- experiments/main/run-3f9c5860/RUN.md
+++ memory/knowledge/claim-boundary.md
@@
- The route clearly beats the baseline and should move forward.
+ The route clearly beats the baseline in aggregate,
+ but the final paper claim must still bound:
+ - causal_judgment
+ - known_unknowns
+ - language_identification
`,
  },
  {
    id: 'diff-paper-outline',
    title: 'Paper branch prepared',
    summary: 'The writing branch converts experiment outputs into a paper-facing structure.',
    leftLabel: 'status.md',
    rightLabel: 'paper/outline.md',
    patch: `--- status.md
+++ paper/outline.md
@@
- Next route: analysis or outline-first writing
+ 1. Failure surface of collaborative truth distortion
+ 2. Confidence-calibrated provenance memory
+ 3. Main MANBENCH result
+ 4. Claim boundary and regression clusters
+ 5. Writing plan and evidence map
`,
  },
] as const

const memoryEntries: TutorialDemoMemoryEntry[] = [
  {
    document_id: 'memory::decisions/route-decision.md',
    title: 'Route decision after main run',
    excerpt: 'The aggregate win is real, but localized regressions still need to bound the final claim.',
    type: 'decision',
    path: 'memory/decisions/route-decision.md',
    updated_at: '2026-03-22T15:22:00Z',
    body: `# Route decision

The main run is strong enough to justify outline-first writing, but not strong enough to skip targeted analysis.

Decision:
- keep the global claim
- bound it with regression analysis
- draft the paper branch in parallel
`,
  },
  {
    document_id: 'memory::decisions/compute_allocation.md',
    title: 'Compute allocation',
    excerpt: 'Most remaining effort should go into claim-boundary analysis and writing, not broad new branch search.',
    type: 'decision',
    path: 'memory/decisions/compute_allocation.md',
    updated_at: '2026-03-22T15:24:00Z',
    body: `# Compute allocation

Do not reopen wide exploration by default.

Priority order:
- bound the claim
- prepare figures and outline
- rerun only if a claim blocker appears
`,
  },
  {
    document_id: 'memory::ideas/idea-969ae84f/idea.md',
    title: 'Selected idea',
    excerpt: 'Confidence-calibrated provenance memory preserved the strongest causal link to the baseline failure surface.',
    type: 'idea',
    path: 'memory/ideas/idea-969ae84f/idea.md',
    updated_at: '2026-03-22T14:18:00Z',
    body: `# Selected idea

Why this branch won:
- it preserves source identity
- it avoids blanket skepticism
- it gives a concrete mechanism for confidence-aware promotion
`,
  },
  {
    document_id: 'memory::knowledge/claim-boundary.md',
    title: 'Claim boundary notes',
    excerpt: 'The aggregate result is strong, but causal_judgment and language_identification still regress locally.',
    type: 'knowledge',
    path: 'memory/knowledge/claim-boundary.md',
    updated_at: '2026-03-22T15:26:00Z',
    body: `# Claim boundary

Still risky:
- causal_judgment
- language_identification
- known_unknowns

Use these clusters to limit overclaiming in the paper.
`,
  },
  {
    document_id: 'memory::knowledge/failure-taxonomy.md',
    title: 'Failure taxonomy',
    excerpt: 'The remaining failures are no longer vague; they cluster into a small number of interpretable task regions.',
    type: 'knowledge',
    path: 'memory/knowledge/failure-taxonomy.md',
    updated_at: '2026-03-22T15:17:00Z',
    body: `# Failure taxonomy

Persistent clusters:
- causal_judgment
- known_unknowns
- language_identification

These clusters define the boundary of the safe paper claim.
`,
  },
  {
    document_id: 'memory::knowledge/speaker_reliability.md',
    title: 'Speaker reliability note',
    excerpt: 'Reliability is contextual; provenance should track evidence form and task context, not only speaker identity.',
    type: 'knowledge',
    path: 'memory/knowledge/speaker_reliability.md',
    updated_at: '2026-03-22T14:56:00Z',
    body: `# Speaker reliability

Avoid using one global trust score.

Instead, keep provenance sensitive to:
- task type
- support type
- agreement with a stable private anchor
`,
  },
  {
    document_id: 'memory::papers/reviewer-risk-register.md',
    title: 'Reviewer risk register',
    excerpt: 'The strongest reviewer pressure will likely target ablations, bounded claims, and whether the route simply became more skeptical.',
    type: 'paper',
    path: 'memory/papers/reviewer-risk-register.md',
    updated_at: '2026-03-22T15:25:00Z',
    body: `# Reviewer risk register

Likely questions:
- is the gain robust?
- does the method simply refuse more?
- which ablation proves the mechanism?
- how narrow should the claim be?
`,
  },
  {
    document_id: 'memory::papers/figure-story.md',
    title: 'Figure story',
    excerpt: 'The paper should foreground the aggregate win, one ablation, and one appendix panel for regression clusters.',
    type: 'paper',
    path: 'memory/papers/figure-story.md',
    updated_at: '2026-03-22T15:23:00Z',
    body: `# Figure story

Main paper:
- aggregate win
- one compact ablation

Appendix:
- regression clusters
- additional failed branches
`,
  },
  {
    document_id: 'memory::episodes/subset-task-discovery-bug.md',
    title: 'Subset task discovery bug',
    excerpt: 'An apparent early failure turned out to be a workflow bug rather than a method failure.',
    type: 'episode',
    path: 'memory/episodes/subset-task-discovery-bug.md',
    updated_at: '2026-03-22T10:44:00Z',
    body: `# Episode

What happened:
- the pilot initially looked weaker than expected
- the cause was not the idea itself
- the task discovery path was silently dropping part of the subset

Why this matters:
- failed-looking runs are not always real method failures
- the workspace should preserve these episodes so later decisions stay calibrated
`,
  },
]

const graphEdges = [
  { from: 'baseline', to: 'idea-a', label: 'branch' },
  { from: 'baseline', to: 'idea-b', label: 'branch' },
  { from: 'baseline', to: 'idea-c', label: 'branch' },
  { from: 'baseline', to: 'idea-d', label: 'branch' },
  { from: 'baseline', to: 'idea-e', label: 'branch' },
  { from: 'idea-c', to: 'run-pilot', label: 'pilot' },
  { from: 'idea-d', to: 'run-ood-scout', label: 'probe' },
  { from: 'idea-e', to: 'run-latency', label: 'stress' },
  { from: 'idea-c', to: 'run-ablation', label: 'ablation' },
  { from: 'idea-c', to: 'run-no-confidence', label: 'ablation' },
  { from: 'idea-c', to: 'run-no-source-tags', label: 'ablation' },
  { from: 'idea-c', to: 'run-main', label: 'main' },
  { from: 'idea-c', to: 'run-memory-budget', label: 'sweep' },
  { from: 'run-main', to: 'analysis-cluster', label: 'inspect' },
  { from: 'run-main', to: 'analysis-ood', label: 'inspect' },
  { from: 'run-main', to: 'analysis-boundary', label: 'inspect' },
  { from: 'run-main', to: 'write-outline', label: 'draft' },
  { from: 'analysis-cluster', to: 'write-figures', label: 'visualize' },
  { from: 'analysis-ood', to: 'write-figures', label: 'appendix' },
  { from: 'analysis-boundary', to: 'decision-route', label: 'route' },
  { from: 'write-outline', to: 'decision-route', label: 'merge' },
  { from: 'write-figures', to: 'decision-figure', label: 'select' },
  { from: 'decision-route', to: 'write-rebuttal', label: 'prepare' },
  { from: 'write-rebuttal', to: 'decision-submit', label: 'handoff' },
  { from: 'decision-figure', to: 'decision-submit', label: 'bundle' },
]

const snapshotBase: QuestSummary = {
  quest_id: '025',
  title: 'Memory',
  status: 'running',
  runtime_status: 'running',
  display_status: 'running',
  active_anchor: 'experiment',
  branch: 'run/ccpm-memory-map',
  runner: 'codex',
  created_at: '2026-03-22T14:00:00Z',
  updated_at: '2026-03-22T15:32:00Z',
  baseline_gate: 'confirmed',
  active_baseline_id: 'mandela-effect-official',
  active_baseline_variant_id: 'gpt-oss-120b-dual-sglang',
  summary: {
    status_line:
      'A baseline-led research tree with multiple idea branches, failed pilots, a strong main run, and a paper route prepared for the next step.',
    latest_metric: {
      key: 'maximal_reality_shift_rate',
      value: 0.1905,
      delta_vs_baseline: -0.4008,
      label: 'maximal_reality_shift_rate',
      direction: 'minimize',
    },
  },
  counts: {
    memory_cards: 9,
    artifacts: 26,
    pending_decision_count: 1,
    bash_session_count: 6,
    bash_running_count: 1,
  },
  guidance: {
    current_anchor: 'decision',
    recommended_skill: 'analysis-campaign',
    recommended_action: 'Bound the claim with targeted regression analysis.',
    summary: 'The main result is already strong. The remaining bottleneck is trustworthy interpretation.',
    why_now: 'A paper-facing claim should preserve the aggregate win without hiding local regressions.',
    complete_when: ['Regression clusters are documented', 'The outline references the bounded claim'],
  },
}

const baselineDetailFacts = [
  { label: 'Quest', value: '025 · Memory' },
  { label: 'Anchor', value: 'baseline' },
  { label: 'Branch', value: 'main' },
  { label: 'Next route', value: 'literature + idea selection' },
] as const

const ideaDetailFacts = [
  { label: 'Quest', value: '025 · Memory' },
  { label: 'Anchor', value: 'idea' },
  { label: 'Active branch', value: 'idea/025-idea-969ae84f' },
  { label: 'Next route', value: 'pilot + ablation' },
] as const

const pilotDetailFacts = [
  { label: 'Quest', value: '025 · Memory' },
  { label: 'Anchor', value: 'experiment pilot' },
  { label: 'Active branch', value: 'idea/025-idea-969ae84f' },
  { label: 'Next route', value: 'promote or retune' },
] as const

const mainRunDetailFacts = [
  { label: 'Quest', value: '025 · Memory' },
  { label: 'Anchor', value: 'main experiment' },
  { label: 'Active branch', value: 'run/ccpm-full-manbench' },
  { label: 'Next route', value: 'analysis or writing' },
] as const

const analysisDetailFacts = [
  { label: 'Quest', value: '025 · Memory' },
  { label: 'Anchor', value: 'analysis-campaign' },
  { label: 'Active branch', value: 'analysis/claim-boundary' },
  { label: 'Next route', value: 'bound claim + update outline' },
] as const

const writeDetailFacts = [
  { label: 'Quest', value: '025 · Memory' },
  { label: 'Anchor', value: 'decision / write' },
  { label: 'Active branch', value: 'paper/run-65c18082' },
  { label: 'Next route', value: 'write now or deepen analysis' },
] as const

const mainRunBestTaskDeltas = [
  { task: 'dyck_languages', before: '0.2457', after: '0.1293', delta: '-0.1164', tone: 'good' },
  { task: 'empirical_judgments', before: '0.1296', after: '0.0577', delta: '-0.0719', tone: 'good' },
  { task: 'tellmewhy', before: '0.1433', after: '0.0881', delta: '-0.0552', tone: 'good' },
] as const

const mainRunRiskTaskDeltas = [
  { task: 'causal_judgment', before: '0.2077', after: '0.2910', delta: '+0.0833', tone: 'bad' },
  { task: 'known_unknowns', before: '0.0238', after: '0.0952', delta: '+0.0714', tone: 'bad' },
  { task: 'language_identification', before: '0.3318', after: '0.3761', delta: '+0.0443', tone: 'bad' },
] as const

const analysisBestTaskDeltas = [
  { task: 'dyck_languages', before: '0.2457', after: '0.1293', delta: '-0.1164', tone: 'good' },
  { task: 'which_wiki_edit', before: '0.3400', after: '0.3033', delta: '-0.0367', tone: 'good' },
  { task: 'vitaminc_fact_verification', before: '0.2633', after: '0.2400', delta: '-0.0233', tone: 'good' },
] as const

const analysisRiskTaskDeltas = [
  { task: 'causal_judgment', before: '0.1385', after: '0.1791', delta: '+0.0406', tone: 'bad' },
  { task: 'language_identification', before: '0.2152', after: '0.2385', delta: '+0.0233', tone: 'bad' },
  { task: 'disambiguation_qa', before: '0.1438', after: '0.1481', delta: '+0.0043', tone: 'bad' },
] as const

const stages: TutorialDemoStage[] = [
  {
    id: 'baseline',
    label: {
      en: 'Baseline attached',
      zh: 'Baseline 已挂载',
    },
    description: {
      en: 'The workspace opens with a confirmed baseline, durable files, and a clean branch point for later idea exploration.',
      zh: '工作区会从一个已确认的 baseline 开始，带着持久文件结构与一个清晰的分叉起点进入后续探索。',
    },
    guideMarkdown: {
      en: `### What to notice

- **Explorer** already has durable files like \`brief.md\`, \`status.md\`, and \`RUN.md\`.
- **Canvas** starts from a trusted baseline node, not an empty screen.
- **Studio** is quiet here because the system is still orienting itself around the anchor.
`,
      zh: `### 这一步重点看什么

- **Explorer** 里已经有 \`brief.md\`、\`status.md\`、\`RUN.md\` 这样的持久文件。
- **Canvas** 不是空白，而是从一个可信 baseline 节点开始。
- **Studio** 目前还比较安静，因为系统还在围绕锚点整理上下文。
`,
    },
    statusLine: {
      en: 'Baseline is confirmed. The workspace is ready to branch into ideas.',
      zh: 'Baseline 已确认，工作区准备进入 idea 分叉。',
    },
    recommendedActions: {
      en: [
        'Open Explorer first and verify that the baseline contract, status file, and reusable artifacts already exist.',
        'Use Canvas to confirm that the workspace starts from a trusted anchor rather than an empty branch.',
        'Before generating new ideas, make sure the baseline metric and comparison target are both stable.',
      ],
      zh: [
        '先打开 Explorer，确认 baseline 合同、status 文件和可复用 artifact 都已经存在。',
        '再去看 Canvas，确认工作区是从一个可信锚点开始，而不是从空白分支开始。',
        '在真正开始产生新 idea 之前，先确保 baseline 指标和比较目标都已经稳定。',
      ],
    },
    visibleNodeIds: ['baseline'],
    anchor: 'baseline',
    latestMetricValue: 0.5913,
    latestMetricDelta: 0,
    activeToolCount: 0,
    currentNodeId: 'baseline',
    graphNodes: makeGraphNodes(withGraphStates({ baseline: 'current' }), 'baseline'),
    bashExec: {
      cwd: '.ds/worktrees/run-ccpm-memory-map',
      command: "sed -n '1,120p' baselines/local/Mandela-Effect/json/metric_contract.json",
      outputLines: [
        '{',
        '  "primary_metric_id": "maximal_reality_shift_rate",',
        '  "direction": "minimize"',
        '}',
      ],
      status: 'completed',
    },
    metricCards: [
      { label: 'Baseline metric', value: '0.5913', tone: 'neutral' },
      { label: 'Current anchor', value: 'baseline confirmed', tone: 'neutral' },
      { label: 'Tracked branches', value: '5 idea slots', tone: 'neutral' },
    ],
    detailFacts: [...baselineDetailFacts],
    bestTaskDeltas: [],
    riskTaskDeltas: [],
    connectorSummary: {
      bindingLabel: 'QQ bound',
      targetLabel: 'qq:direct:demo-memory::thread-001',
      latestStatus: 'idle',
      latestMessage: 'The connector is already attached, but no milestone has been delivered yet.',
    },
    chatSuggestions: [
      {
        en: 'Summarize the baseline contract before idea selection.',
        zh: '先总结 baseline 合同，再进入 idea 选择。',
      },
      {
        en: 'Which failure surface matters most right now?',
        zh: '当前最值得盯的 failure surface 是什么？',
      },
    ],
    feed: [
      makeOperation({
        id: 'operation-0a',
        label: 'tool_call',
        createdAt: '2026-03-22T14:01:30Z',
        status: 'completed',
        args: `{\n  "command": "sed -n '1,120p' baselines/local/Mandela-Effect/json/metric_contract.json",\n  "workdir": ".ds/worktrees/run-ccpm-memory-map"\n}`,
        subject: 'Inspect the accepted baseline metric contract before branching',
      }),
      makeOperation({
        id: 'operation-0b',
        label: 'tool_result',
        createdAt: '2026-03-22T14:01:50Z',
        status: 'completed',
        output:
          'primary_metric_id = maximal_reality_shift_rate\\ndirection = minimize\\ncomparison target = confirmed baseline',
        subject: 'Baseline contract recovered and ready for later branch comparison',
      }),
      {
        id: 'feed-msg-1',
        type: 'message',
        role: 'assistant',
        content:
          'Imported the confirmed baseline and reconstructed the quest scaffold. I am now comparing candidate idea branches before any full run.',
        createdAt: '2026-03-22T14:02:00Z',
      },
      makeArtifact({
        id: 'artifact-1',
        kind: 'milestone',
        content: 'Baseline confirmed and workspace initialized.',
        createdAt: '2026-03-22T14:03:00Z',
        status: 'ready',
      }),
      makeArtifact({
        id: 'artifact-1b',
        kind: 'progress',
        content: 'Baseline is stable enough to stop reproducing and move into literature-backed idea selection.',
        createdAt: '2026-03-22T14:05:00Z',
        status: 'active',
      }),
      {
        id: 'feed-msg-1c',
        type: 'message',
        role: 'assistant',
        content:
          'Connector binding is already active, so later milestones can be sent outside the workspace without extra setup.',
        createdAt: '2026-03-22T14:05:30Z',
      },
    ],
  },
  {
    id: 'idea',
    label: {
      en: 'Idea tree expanded',
      zh: 'Idea 树已展开',
    },
    description: {
      en: 'Multiple ideas branch from the same baseline. Some are retired early, one becomes the main route, and others stay useful as side evidence.',
      zh: '多个 idea 会从同一个 baseline 节点分叉出来，其中有的很快被淘汰，有的变成主路线，还有一些作为旁证被保留下来。',
    },
    guideMarkdown: {
      en: `### What this stage teaches

1. A research map should show **multiple branches**, not only the winning one.
2. Some ideas fail fast, and that failure is still useful memory.
3. The selected branch should feel **earned by evidence**, not arbitrary.
`,
      zh: `### 这一步在教什么

1. 一个 research map 应该展示**多个分支**，而不是只展示最终胜出的那条。
2. 有些 idea 会快速失败，但这些失败依然是有价值的记忆。
3. 被保留下来的主方向应该是**被证据选出来的**，而不是随意决定的。
`,
    },
    statusLine: {
      en: 'Five idea branches were compared. Confidence-calibrated provenance memory is selected as the main route.',
      zh: '五个 idea 分支已对比完成，最终选择了置信度校准的来源记忆方案作为主路线。',
    },
    recommendedActions: {
      en: [
        'Use Canvas to compare the candidate branches and confirm that the selected route was earned by evidence.',
        'Open the idea files in Explorer and read both the candidate slate and the selected idea summary.',
        'If you were reviewing this project, this is the stage to challenge branch selection before more compute is spent.',
      ],
      zh: [
        '先在 Canvas 上对比各个 candidate branch，确认主路线确实是被证据筛出来的。',
        '再去 Explorer 打开 idea 文件，同时看候选列表和最终选中的 idea 摘要。',
        '如果你是在评审这个项目，这一阶段最适合在继续烧更多算力之前质疑分支选择是否合理。',
      ],
    },
    visibleNodeIds: IDEA_STAGE_NODE_IDS,
    anchor: 'idea',
    latestMetricValue: 0.5913,
    latestMetricDelta: 0,
    activeToolCount: 0,
    currentNodeId: 'idea-c',
    graphNodes: makeGraphNodes(
      withGraphStates({
        baseline: 'done',
        'idea-a': 'failed',
        'idea-b': 'done',
        'idea-c': 'current',
        'idea-d': 'done',
        'idea-e': 'failed',
      }),
      'idea-c'
    ),
    bashExec: {
      cwd: '.ds/worktrees/run-ccpm-memory-map',
      command: "sed -n '1,200p' memory/ideas/idea-969ae84f/idea.md",
      outputLines: [
        '# Confidence-Calibrated Provenance Memory',
        '',
        '- separate self-knowledge / peer claims / evidence type',
        '- calibrate write + retrieval promotion by confidence',
      ],
      status: 'completed',
    },
    metricCards: [
      { label: 'Idea branches', value: '5', tone: 'neutral' },
      { label: 'Rejected quickly', value: '2', tone: 'bad' },
      { label: 'Selected idea', value: 'provenance memory', tone: 'good' },
    ],
    detailFacts: [...ideaDetailFacts],
    bestTaskDeltas: [],
    riskTaskDeltas: [],
    connectorSummary: {
      bindingLabel: 'QQ bound',
      targetLabel: 'qq:direct:demo-memory::thread-001',
      latestStatus: 'selection sent',
      latestMessage: 'The selected-idea update has been sent to the bound QQ thread as a threaded progress message.',
    },
    chatSuggestions: [
      {
        en: 'Explain why the selected idea beat the other branches.',
        zh: '解释一下为什么当前选中的 idea 能胜过其他分支。',
      },
      {
        en: 'What is the strongest alternative if this branch stalls?',
        zh: '如果当前分支卡住，最强的备选路线是什么？',
      },
    ],
    feed: [
      makeOperation({
        id: 'operation-0c',
        label: 'tool_call',
        createdAt: '2026-03-22T14:09:10Z',
        status: 'completed',
        args: `{\n  "command": "sed -n '1,220p' artifacts/idea/selection_rationale.md",\n  "workdir": ".ds/worktrees/run-ccpm-memory-map"\n}`,
        subject: 'Read the branch-selection rationale before promoting an idea',
      }),
      makeOperation({
        id: 'operation-0d',
        label: 'tool_result',
        createdAt: '2026-03-22T14:09:35Z',
        status: 'completed',
        output:
          'selected = confidence-calibrated provenance memory\\nwhy = best match to the observed failure surface\\nrejected = debate-only safeguard, contradiction trace buffer',
        subject: 'The selected idea is evidence-backed rather than arbitrary',
      }),
      {
        id: 'feed-msg-2',
        type: 'message',
        role: 'assistant',
        content:
          'I compared three candidate ideas against the baseline failure surface. The provenance-aware memory branch is now the strongest route forward.',
        createdAt: '2026-03-22T14:10:00Z',
      },
      makeArtifact({
        id: 'artifact-2',
        kind: 'decision',
        content: 'Selected Confidence-Calibrated Provenance Memory as the main branch.',
        createdAt: '2026-03-22T14:12:00Z',
        status: 'accepted',
      }),
      makeArtifact({
        id: 'artifact-2b',
        kind: 'progress',
        content: 'Connector delivery: selected-idea update sent to QQ thread `demo-memory::thread-001`.',
        createdAt: '2026-03-22T14:12:20Z',
        status: 'delivered',
      }),
      {
        id: 'feed-msg-2b',
        type: 'message',
        role: 'assistant',
        content:
          'The branch wins because it keeps social learning selective without collapsing into blanket refusal, which matches the project goal more cleanly than the rejected alternatives.',
        createdAt: '2026-03-22T14:13:00Z',
      },
    ],
  },
  {
    id: 'pilot',
    label: {
      en: 'Pilot and ablation',
      zh: 'Pilot 与 ablation',
    },
    description: {
      en: 'The graph becomes more realistic here: one pilot gains signal, one ablation fails, and the main branch stays alive.',
      zh: '这里开始出现更真实的试错结构：一个 pilot 有信号，一个 ablation 失败，而主分支被保留下来继续推进。',
    },
    guideMarkdown: {
      en: `### Why this matters

- The graph should not look like a straight line.
- A useful workspace keeps **successful**, **failed**, and **still-open** paths together.
- The best branch here is not declared final yet; it only earns a larger run.
`,
      zh: `### 为什么这一步很重要

- 研究图谱不应该看起来像一条直线。
- 一个好的工作区会同时保留**成功**、**失败**和**仍在推进**的路径。
- 此时最好的分支还不能直接宣告胜利，它只是赢得了更大规模的下一轮实验。
`,
    },
    statusLine: {
      en: 'Pilot evidence is mixed. The ablation branch failed, but the main route still looks justified.',
      zh: 'Pilot 证据喜忧参半。Ablation 分支失败，但主分支依然值得继续。',
    },
    recommendedActions: {
      en: [
        'Read Studio to understand what the pilot actually ran and how the ablation failed.',
        'Check Details before deciding whether a local gain is strong enough to promote.',
        'Use Chat here when you want to ask whether the branch should be scaled up, retuned, or stopped.',
      ],
      zh: [
        '先看 Studio，搞清楚 pilot 到底跑了什么，以及 ablation 是怎样失败的。',
        '在决定要不要升级之前，先去 Details 判断这个局部增益是否真的足够强。',
        '如果你要决定是扩规模、微调还是停止，这一阶段最适合通过 Chat 直接介入。',
      ],
    },
    visibleNodeIds: PILOT_STAGE_NODE_IDS,
    anchor: 'experiment',
    latestMetricValue: 0.4412,
    latestMetricDelta: -0.1501,
    activeToolCount: 1,
    currentNodeId: 'run-pilot',
    graphNodes: makeGraphNodes(
      withGraphStates({
        baseline: 'done',
        'idea-a': 'failed',
        'idea-b': 'done',
        'idea-c': 'done',
        'idea-d': 'done',
        'idea-e': 'failed',
        'run-pilot': 'current',
        'run-ood-scout': 'done',
        'run-latency': 'failed',
        'run-ablation': 'failed',
        'run-no-confidence': 'failed',
        'run-no-source-tags': 'done',
      }),
      'run-pilot'
    ),
    bashExec: {
      cwd: '.ds/worktrees/run-ccpm-memory-map',
      command: 'python scripts/eval_branch.py --subset pilot --config configs/ccpm.yaml',
      outputLines: [
        'Loaded 6 MANBENCH tasks',
        'pilot maximal_reality_shift_rate = 0.4412',
        'delta_vs_baseline = -0.1501',
        'saved experiments/pilot/run-0c3e/RESULT.json',
      ],
      status: 'running',
    },
    metricCards: [
      { label: 'Pilot metric', value: '0.4412', delta: '-0.1501', tone: 'good' },
      { label: 'Ablation branches', value: '3 failed', tone: 'bad' },
      { label: 'Live experiment tree', value: '6 branches', tone: 'neutral' },
    ],
    detailFacts: [...pilotDetailFacts],
    bestTaskDeltas: [
      { task: 'known_unknowns', before: '0.3571', after: '0.2143', delta: '-0.1428', tone: 'good' },
      { task: 'dyck_languages', before: '0.2812', after: '0.2031', delta: '-0.0781', tone: 'good' },
    ],
    riskTaskDeltas: [
      { task: 'which_wiki_edit', before: '0.1800', after: '0.2133', delta: '+0.0333', tone: 'bad' },
      { task: 'salient_translation_error_detection', before: '0.2211', after: '0.2400', delta: '+0.0189', tone: 'bad' },
    ],
    connectorSummary: {
      bindingLabel: 'QQ bound',
      targetLabel: 'qq:direct:demo-memory::thread-001',
      latestStatus: 'pilot update sent',
      latestMessage: 'Pilot progress and the failed ablation note have both been sent to the bound connector thread.',
    },
    chatSuggestions: [
      {
        en: 'Should this pilot be promoted to a full run now?',
        zh: '这个 pilot 现在值得升到 full run 吗？',
      },
      {
        en: 'What did the failed ablation teach us?',
        zh: '失败的 ablation 到底教会了我们什么？',
      },
    ],
    feed: [
      makeOperation({
        id: 'operation-1',
        label: 'tool_call',
        createdAt: '2026-03-22T14:28:00Z',
        status: 'running',
        args: `{\n  "command": "python scripts/eval_branch.py --subset pilot --config configs/ccpm.yaml",\n  "workdir": ".ds/worktrees/run-ccpm-memory-map"\n}`,
        subject: 'Pilot evaluation on the selected idea branch',
      }),
      makeOperation({
        id: 'operation-2',
        label: 'tool_result',
        createdAt: '2026-03-22T14:31:00Z',
        status: 'completed',
        output: 'pilot maximal_reality_shift_rate = 0.4412\\ndelta_vs_baseline = -0.1501',
        subject: 'Pilot result beat the baseline but is still not claim-ready',
      }),
      makeArtifact({
        id: 'artifact-3',
        kind: 'progress',
        content: 'Pilot gain is real enough to justify a full run. One ablation branch already failed cleanly.',
        createdAt: '2026-03-22T14:32:00Z',
        status: 'active',
      }),
      makeArtifact({
        id: 'artifact-3b',
        kind: 'progress',
        content: 'Connector delivery: pilot checkpoint sent to QQ with both the promising signal and the failed ablation context.',
        createdAt: '2026-03-22T14:32:25Z',
        status: 'delivered',
      }),
      {
        id: 'feed-msg-3b',
        type: 'message',
        role: 'assistant',
        content:
          'I am not treating this pilot as final evidence yet. The right next move is to scale carefully, not to overclaim from a subset win.',
        createdAt: '2026-03-22T14:33:00Z',
      },
    ],
  },
  {
    id: 'main-run',
    label: {
      en: 'Main run lands',
      zh: '主实验落盘',
    },
    description: {
      en: 'The main branch now finishes cleanly and overtakes the baseline by a large margin.',
      zh: '主实验完整结束，并且以较大幅度超过 baseline。',
    },
    guideMarkdown: {
      en: `### What changes here

- **Studio** becomes much richer because the run now includes tool calls, outputs, and a milestone artifact.
- **Details** can finally show a strong headline metric.
- **Canvas** upgrades the main experiment node from "pending" to "earned result".
`,
      zh: `### 这一步会带来什么变化

- **Studio** 会明显丰富起来，因为现在已经有了工具调用、输出结果和 milestone artifact。
- **Details** 终于可以展示一个有说服力的核心指标。
- **Canvas** 会把主实验节点从“待推进”升级为真正“拿到结果”的状态。
`,
    },
    statusLine: {
      en: 'Main experiment finished. The aggregate result is now strong enough to move into analysis and writing.',
      zh: '主实验已完成，整体结果已经强到足以进入分析与写作准备。',
    },
    recommendedActions: {
      en: [
        'Start from Details to verify the headline metric, the delta against baseline, and the strongest supporting evidence.',
        'Then open Studio to inspect the exact bash_exec trail and the milestone that recorded the win.',
        'Do not move into writing yet unless you also understand which task clusters still regress.',
      ],
      zh: [
        '先从 Details 开始，确认 headline metric、相对 baseline 的增益，以及最强支撑证据。',
        '然后去 Studio，看清楚完整 bash_exec 轨迹以及记录胜利的 milestone。',
        '在没有搞清楚哪些 task cluster 仍然回退之前，不要急着直接进入写作。',
      ],
    },
    visibleNodeIds: MAIN_STAGE_NODE_IDS,
    anchor: 'experiment',
    latestMetricValue: 0.1905,
    latestMetricDelta: -0.4008,
    activeToolCount: 0,
    currentNodeId: 'run-main',
    graphNodes: makeGraphNodes(
      withGraphStates({
        baseline: 'done',
        'idea-a': 'failed',
        'idea-b': 'done',
        'idea-c': 'done',
        'idea-d': 'done',
        'idea-e': 'failed',
        'run-pilot': 'done',
        'run-ood-scout': 'done',
        'run-latency': 'failed',
        'run-ablation': 'failed',
        'run-no-confidence': 'failed',
        'run-no-source-tags': 'done',
        'run-main': 'current',
        'run-memory-budget': 'done',
      }),
      'run-main'
    ),
    bashExec: {
      cwd: '.ds/worktrees/run-ccpm-memory-map',
      command: 'python scripts/eval_branch.py --subset full --config configs/ccpm.yaml',
      outputLines: [
        'Loaded 20 MANBENCH tasks',
        'baseline maximal_reality_shift_rate = 0.5913',
        'run maximal_reality_shift_rate = 0.1905',
        'delta_vs_baseline = -0.4008',
        'Saved experiments/main/run-3f9c5860/RESULT.json',
      ],
      status: 'completed',
    },
    metricCards: [
      { label: 'Main metric', value: '0.1905', delta: '-0.4008', tone: 'good' },
      { label: 'Compared tasks', value: '20/20', tone: 'good' },
      { label: 'Experiment branches', value: '8 tracked', tone: 'good' },
    ],
    detailFacts: [...mainRunDetailFacts],
    bestTaskDeltas: [...mainRunBestTaskDeltas],
    riskTaskDeltas: [...mainRunRiskTaskDeltas],
    connectorSummary: {
      bindingLabel: 'QQ bound',
      targetLabel: 'qq:direct:demo-memory::thread-001',
      latestStatus: 'main milestone sent',
      latestMessage: 'The full-run milestone and main metric win have been delivered to the connector thread.',
    },
    chatSuggestions: [
      {
        en: 'Summarize the strongest evidence for moving into writing.',
        zh: '总结一下为什么现在已经值得进入写作。',
      },
      {
        en: 'Which task regressions still block overclaiming?',
        zh: '哪些任务级回退还在阻止我们过度宣称？',
      },
    ],
    feed: [
      makeOperation({
        id: 'operation-3',
        label: 'tool_call',
        createdAt: '2026-03-22T14:50:00Z',
        status: 'running',
        args: `{\n  "command": "python scripts/eval_branch.py --subset full --config configs/ccpm.yaml",\n  "workdir": ".ds/worktrees/run-ccpm-memory-map"\n}`,
        subject: 'Full MANBENCH sweep on the main branch',
      }),
      makeOperation({
        id: 'operation-4',
        label: 'tool_result',
        createdAt: '2026-03-22T15:06:00Z',
        status: 'completed',
        output: 'maximal_reality_shift_rate = 0.1905\\ndelta_vs_baseline = -0.4008\\nverdict = good',
        subject: 'Main result beats the confirmed baseline with a large gap',
      }),
      makeArtifact({
        id: 'artifact-4',
        kind: 'milestone',
        content: 'Main run `run-3f9c5860` finished with a major aggregate improvement over the baseline.',
        createdAt: '2026-03-22T15:08:00Z',
        status: 'good',
      }),
      makeArtifact({
        id: 'artifact-4c',
        kind: 'progress',
        content: 'Connector delivery: main milestone sent to QQ thread with metric summary and next-route recommendation.',
        createdAt: '2026-03-22T15:08:20Z',
        status: 'delivered',
      }),
      makeArtifact({
        id: 'artifact-4b',
        kind: 'decision',
        content: 'The result is strong enough to move into analysis and writing preparation, but still needs claim-boundary review.',
        createdAt: '2026-03-22T15:10:00Z',
        status: 'accepted',
      }),
    ],
  },
  {
    id: 'analysis',
    label: {
      en: 'Analysis branch',
      zh: '分析分支',
    },
    description: {
      en: 'The workspace now pivots into interpretation: preserve the strong claim, but make the failure boundary explicit.',
      zh: '工作区此时进入解释阶段：保留强结论，但把失败边界清楚地呈现出来。',
    },
    guideMarkdown: {
      en: `### What a mature workspace shows

- A strong result is **not** the end of the story.
- The system should remember where it still fails.
- Analysis is what turns a good run into a paper-worthy claim.
`,
      zh: `### 一个成熟工作区应该展示什么

- 有了强结果以后，故事**并没有结束**。
- 系统不仅要记住成功，也要记住它仍然失败在哪些地方。
- 分析环节决定了一次好实验能不能真正变成可信的论文结论。
`,
    },
    statusLine: {
      en: 'Claim-boundary analysis is active. The goal is not another rerun, but a trustworthy explanation.',
      zh: '当前正在做 claim-boundary 分析，目标不是再跑一遍，而是给出可信解释。',
    },
    recommendedActions: {
      en: [
        'Open Memory and read the claim-boundary notes before making any paper-facing statement.',
        'Use Details to compare the strongest wins against the remaining risk clusters.',
        'This is the right moment to ask Chat for a bounded claim rather than another open-ended improvement idea.',
      ],
      zh: [
        '在做任何面向论文的表述之前，先去 Memory 把 claim-boundary 笔记读一遍。',
        '再通过 Details 对照最强增益和剩余风险簇。',
        '这一阶段最适合在 Chat 里要求系统给出“有边界的结论”，而不是继续发散新 idea。',
      ],
    },
    visibleNodeIds: ANALYSIS_STAGE_NODE_IDS,
    anchor: 'analysis-campaign',
    latestMetricValue: 0.1905,
    latestMetricDelta: -0.4008,
    activeToolCount: 0,
    currentNodeId: 'analysis-boundary',
    graphNodes: makeGraphNodes(
      withGraphStates({
        baseline: 'done',
        'idea-a': 'failed',
        'idea-b': 'done',
        'idea-c': 'done',
        'idea-d': 'done',
        'idea-e': 'failed',
        'run-pilot': 'done',
        'run-ood-scout': 'done',
        'run-latency': 'failed',
        'run-ablation': 'failed',
        'run-no-confidence': 'failed',
        'run-no-source-tags': 'done',
        'run-main': 'done',
        'run-memory-budget': 'done',
        'analysis-cluster': 'done',
        'analysis-ood': 'done',
        'analysis-boundary': 'current',
      }),
      'analysis-boundary'
    ),
    bashExec: {
      cwd: '.ds/worktrees/analysis-ccpm-memory-map',
      command: "python scripts/analyze_errors.py --run experiments/main/run-3f9c5860 --focus causal_judgment,known_unknowns",
      outputLines: [
        'Loaded task-level records for 20 tasks',
        'Found localized regressions in causal_judgment, language_identification, known_unknowns',
        'Wrote artifacts/analysis/claim-boundary.md',
      ],
      status: 'completed',
    },
    metricCards: [
      { label: 'Aggregate still best', value: '0.1905', delta: '-0.4008', tone: 'good' },
      { label: 'Local regressions', value: '3 clusters', tone: 'bad' },
      { label: 'Next writing task', value: 'bound the claim', tone: 'neutral' },
    ],
    detailFacts: [...analysisDetailFacts],
    bestTaskDeltas: [...analysisBestTaskDeltas],
    riskTaskDeltas: [...analysisRiskTaskDeltas],
    connectorSummary: {
      bindingLabel: 'QQ bound',
      targetLabel: 'qq:direct:demo-memory::thread-001',
      latestStatus: 'analysis note sent',
      latestMessage: 'Claim-boundary analysis has been pushed to the connector thread as a follow-up checkpoint.',
    },
    chatSuggestions: [
      {
        en: 'Write the claim boundary in one paragraph.',
        zh: '用一段话写出当前的 claim boundary。',
      },
      {
        en: 'What should be analyzed before finalizing the paper claim?',
        zh: '在最终定论文 claim 之前，还应该分析什么？',
      },
    ],
    feed: [
      {
        id: 'feed-msg-3',
        type: 'message',
        role: 'assistant',
        content:
          'The aggregate win is now locked. I am shifting to claim-boundary analysis so the paper does not overstate what the new method actually fixes.',
        createdAt: '2026-03-22T15:14:00Z',
      },
      makeArtifact({
        id: 'artifact-5',
        kind: 'analysis',
        content: 'Three localized regression clusters remain and should be used to bound the final paper claim.',
        createdAt: '2026-03-22T15:18:00Z',
        status: 'active',
      }),
      makeArtifact({
        id: 'artifact-5b',
        kind: 'progress',
        content: 'Connector delivery: analysis checkpoint sent with explicit regression clusters and writing caution.',
        createdAt: '2026-03-22T15:18:18Z',
        status: 'delivered',
      }),
      makeOperation({
        id: 'operation-5',
        label: 'tool_call',
        createdAt: '2026-03-22T15:19:00Z',
        status: 'completed',
        args: `{\n  "command": "sed -n '1,220p' artifacts/reports/confidence_calibrated_provisional_memory_full_comparison.md",\n  "workdir": ".ds/worktrees/paper-run-65c18082"\n}`,
        output: 'Loaded full comparison report and extracted best/worst task deltas.',
        subject: 'Read the durable comparison report before writing the bounded claim',
      }),
    ],
  },
  {
    id: 'write',
    label: {
      en: 'Writing route prepared',
      zh: '写作路线已准备',
    },
    description: {
      en: 'The final stage shows a paper branch, a live decision node, and a workspace ready for human collaboration.',
      zh: '最后一个阶段会展示 paper 分支、决策节点，以及一个已准备好供人类协作的工作区。',
    },
    guideMarkdown: {
      en: `### Final handoff

- The workspace now feels **resumable** rather than disposable.
- A person can inspect the graph, read memory, open files, and choose the next route.
- This is the moment where DeepScientist behaves like a growing research map instead of a one-shot agent run.
`,
      zh: `### 最终交接点

- 此时工作区已经是一个**可继续推进**的研究环境，而不是一次性结果。
- 人可以检查图谱、阅读 memory、打开文件，并明确选择下一条路线。
- 这也是 DeepScientist 更像“会生长的科研地图”而不是“一次性 agent 执行”的地方。
`,
    },
    statusLine: {
      en: 'Outline-first writing is ready. The next action is a visible decision between deeper analysis and drafting now.',
      zh: '大纲优先的写作分支已经准备好。下一步是在人类可见的决策点上选择继续分析，还是直接起草论文。',
    },
    recommendedActions: {
      en: [
        'Use Canvas to understand how the project reached this handoff point across baseline, experiments, analysis, and writing.',
        'Open Explorer and read the outline, comparison report, and route decision together before choosing the next route.',
        'At this stage, human collaboration should be decisive: either deepen analysis or move directly into drafting.',
      ],
      zh: [
        '先在 Canvas 上理解这个项目是如何穿过 baseline、实验、分析和写作走到当前交接点的。',
        '然后去 Explorer 同时打开 outline、comparison report 和 route decision，再做下一步选择。',
        '到这一阶段，人类协作应该真正接手：要么继续做分析，要么直接推进写作。',
      ],
    },
    visibleNodeIds: WRITE_STAGE_NODE_IDS,
    anchor: 'decision',
    latestMetricValue: 0.1905,
    latestMetricDelta: -0.4008,
    activeToolCount: 0,
    currentNodeId: 'decision-route',
    graphNodes: makeGraphNodes(
      withGraphStates({
        baseline: 'done',
        'idea-a': 'failed',
        'idea-b': 'done',
        'idea-c': 'done',
        'idea-d': 'done',
        'idea-e': 'failed',
        'run-pilot': 'done',
        'run-ood-scout': 'done',
        'run-latency': 'failed',
        'run-ablation': 'failed',
        'run-no-confidence': 'failed',
        'run-no-source-tags': 'done',
        'run-main': 'done',
        'run-memory-budget': 'done',
        'analysis-cluster': 'done',
        'analysis-ood': 'done',
        'analysis-boundary': 'done',
        'write-outline': 'done',
        'write-figures': 'done',
        'write-rebuttal': 'done',
        'decision-route': 'current',
        'decision-figure': 'done',
      }),
      'decision-route'
    ),
    bashExec: {
      cwd: '.ds/worktrees/paper-run-65c18082',
      command: "sed -n '1,200p' paper/outline.md",
      outputLines: [
        '# Outline',
        '1. Failure surface of collaborative truth distortion',
        '2. Confidence-calibrated provenance memory',
        '3. Main result and claim boundary',
      ],
      status: 'completed',
    },
    metricCards: [
      { label: 'Paper branch', value: 'ready', tone: 'good' },
      { label: 'Decision node', value: 'analysis or write', tone: 'neutral' },
      { label: 'Human workshop', value: 'open for edits', tone: 'good' },
    ],
    detailFacts: [...writeDetailFacts],
    bestTaskDeltas: [...mainRunBestTaskDeltas],
    riskTaskDeltas: [...analysisRiskTaskDeltas],
    connectorSummary: {
      bindingLabel: 'QQ bound',
      targetLabel: 'qq:direct:demo-memory::thread-001',
      latestStatus: 'outline milestone sent',
      latestMessage: 'The outline-first writing milestone has been sent, so a human can step in from the connector thread or from the workspace.',
    },
    chatSuggestions: [
      {
        en: 'Draft the next route recommendation for the human reviewer.',
        zh: '为人类评审者起草下一步路线建议。',
      },
      {
        en: 'Should we write now or deepen the analysis branch first?',
        zh: '现在应该直接写，还是先把分析分支再做深一点？',
      },
    ],
    feed: [
      makeOperation({
        id: 'operation-6a',
        label: 'tool_call',
        createdAt: '2026-03-22T15:23:15Z',
        status: 'completed',
        args: `{\n  "command": "sed -n '1,220p' paper/figures/figure_plan.md",\n  "workdir": ".ds/worktrees/paper-run-65c18082"\n}`,
        subject: 'Read the paper figure plan before freezing the writing route',
      }),
      makeArtifact({
        id: 'artifact-6',
        kind: 'milestone',
        content: 'Paper branch bootstrapped. Outline-first writing can proceed in parallel with bounded analysis.',
        createdAt: '2026-03-22T15:24:00Z',
        status: 'ready',
      }),
      makeArtifact({
        id: 'artifact-6b',
        kind: 'progress',
        content: 'Connector delivery: paper-branch milestone sent to QQ with a direct route-decision prompt.',
        createdAt: '2026-03-22T15:24:20Z',
        status: 'delivered',
      }),
      {
        id: 'feed-msg-4',
        type: 'message',
        role: 'assistant',
        content:
          'The workspace is now at a clean handoff point: failed attempts are preserved, the main run is durable, and the next route is explicit.',
        createdAt: '2026-03-22T15:26:00Z',
      },
      makeOperation({
        id: 'operation-6',
        label: 'tool_result',
        createdAt: '2026-03-22T15:27:00Z',
        status: 'completed',
        output: 'paper/outline.md created\\npaper/claim_map.md updated',
        subject: 'Prepared paper-facing structure from the recorded experiment evidence',
      }),
    ],
  },
]

export const quickstartTutorialDemoScenario: TutorialDemoScenario = {
  id: 'quickstart',
  questId: '025',
  title: 'Memory',
  subtitle: {
    en: 'A guided research workspace showing baseline recovery, branching ideas, failed pilots, a main run, analysis, paper-line health, and writing in one place.',
    zh: '一个引导式科研工作区，把 baseline 恢复、idea 分叉、失败试错、主实验、分析、paper line 健康状态和写作都放在同一个界面里。',
  },
  branch: 'run/ccpm-memory-map',
  baselineLabel: 'mandela-effect-official / gpt-oss-120b-dual-sglang',
  projectRoot: '/guided/quests/025',
  snapshotBase,
  explorerFiles,
  diffs: [...diffs],
  memoryEntries,
  graphEdges,
  stages,
  openingChat: [
    {
      id: 'chat-0',
      role: 'user',
      content: {
        en: 'I need a route that stays robust under mixed social signals while still learning from correct collaborators.',
        zh: '我需要一条路线，在混合社会信号下依然保持事实鲁棒，同时还能从正确协作者那里学习。',
      },
    },
    {
      id: 'chat-1',
      role: 'assistant',
      content: {
        en: 'The baseline is already in place and the research tree is ready to branch.',
        zh: 'Baseline 已经就位，研究树也已经准备好向外分叉。',
      },
    },
    {
      id: 'chat-2',
      role: 'assistant',
      content: {
        en: 'Use this workspace like a live project: Explorer shows files, Canvas shows structure, Details now highlights paper-line health and blockers, and Studio shows the execution trace.',
        zh: '你可以把这个工作区当成一个正在推进的真实项目：Explorer 看文件，Canvas 看结构，Details 现在会突出 paper line 的健康状态与阻塞项，Studio 看执行轨迹。',
      },
    },
  ],
}

export const tutorialDemoScenarios = {
  quickstart: quickstartTutorialDemoScenario,
} satisfies Record<string, TutorialDemoScenario>
