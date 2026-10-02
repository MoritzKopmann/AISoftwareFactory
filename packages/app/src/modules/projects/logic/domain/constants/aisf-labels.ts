export type AisfLabel = {
  readonly name: string;
  readonly color: string;
  readonly description: string;
};

export const aisfLabels: ReadonlyArray<AisfLabel> = [
  { name: 'type: bug', color: 'D73A4A', description: "Something isn't working correctly" },
  { name: 'type: enhancement', color: 'A2EEEF', description: 'New feature or improvement' },
  { name: 'type: task', color: 'BFD4F2', description: 'Non-feature work item' },
  { name: 'type: spike', color: 'D4C5F9', description: 'Research or investigation' },
  { name: 'type: ui', color: 'C5DEF5', description: 'Design-driven UI work' },
  { name: 'priority: critical', color: 'B60205', description: 'Must fix immediately' },
  { name: 'priority: high', color: 'D93F0B', description: 'Important, next up' },
  { name: 'priority: medium', color: 'E99695', description: 'Normal backlog priority' },
  { name: 'priority: low', color: 'F9D0C4', description: 'Nice to have' },
  {
    name: 'status: backlog',
    color: 'C2E0C6',
    description: 'Specified, parked until moved to plan',
  },
  { name: 'status: plan', color: '1D76DB', description: 'Waiting for the plan interview' },
  {
    name: 'status: planned',
    color: 'BFDADC',
    description: 'Umbrella; closes when its last child closes',
  },
  { name: 'status: ready', color: '0E8A16', description: 'Leaf that may be implemented now' },
  {
    name: 'status: in-progress',
    color: 'FBCA04',
    description: 'Implementation run in progress',
  },
  { name: 'status: in-review', color: 'E4E669', description: 'PR open, awaiting review' },
  { name: 'status: stuck', color: 'B60205', description: 'A run gave up; needs a human' },
  {
    name: 'hitl',
    color: 'F9A825',
    description: 'Runs as an interactive session, never AFK',
  },
];
