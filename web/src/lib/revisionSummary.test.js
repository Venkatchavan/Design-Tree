import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRevisions } from './revisionSummary.js';

test('summarizes revisions by stage, completion timing, and drawing service', () => {
  const summary = summarizeRevisions(
    [
      { stage: 'Concept', drawing: 'S-01' },
      { stage: 'Design development', drawing: 'S-02' },
      { stage: 'Schematic', drawing: 'MEP-01' },
    ],
    [
      { drawingNo: 'S-01', service: 'Structural' },
      { drawingNo: 'S-02', service: 'Structural' },
      { drawingNo: 'MEP-01', service: 'MEPF' },
    ],
    [
      { service: 'Structural', stage: 'Concept', currentStatus: 'In progress' },
      { service: 'Structural', stage: 'Design development', currentStatus: 'In progress' },
      { service: 'MEPF', stage: 'Schematic', currentStatus: 'Completed' },
    ],
    { currentStage: 'DD', status: 'Active' },
  );

  assert.equal(summary.total, 3);
  assert.equal(summary.within, 2);
  assert.equal(summary.after, 1);
  assert.deepEqual(
    summary.stageRows.filter((row) => row.total > 0),
    [
      { stage: 'Concept', within: 1, after: 0, total: 1 },
      { stage: 'Schematic', within: 0, after: 1, total: 1 },
      { stage: 'Design development', within: 1, after: 0, total: 1 },
    ],
  );
  assert.deepEqual(
    summary.serviceRows.map(({ service, stages, within, after, total }) => ({
      service, stages, within, after, total,
    })),
    [
      { service: 'MEPF', stages: 'Schematic', within: 0, after: 1, total: 1 },
      { service: 'Structural', stages: 'Concept, Design development', within: 2, after: 0, total: 2 },
    ],
  );
});

test('keeps revisions without an unambiguous drawing service in an Unassigned row', () => {
  const summary = summarizeRevisions(
    [{ stage: 'Concept', drawing: 'Unknown drawing' }],
    [],
    [],
    { currentStage: 'CD', status: 'Active' },
  );

  assert.deepEqual(
    summary.serviceRows.map(({ service, stages, within, after, total }) => ({
      service, stages, within, after, total,
    })),
    [{ service: 'Unassigned', stages: 'Concept', within: 1, after: 0, total: 1 }],
  );
});
