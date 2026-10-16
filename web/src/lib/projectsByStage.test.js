import test from 'node:test';
import assert from 'node:assert/strict';
import { projectsByStageChart } from './projectsByStage.js';

test('projects by stage reflects the selected branch', () => {
  const allBranches = [
    { stage: 'Concept', count: 2 },
    { stage: 'GFC', count: 1 },
  ];
  const byBranch = {
    Bengaluru: [
      { stage: 'Concept', count: 1 },
      { stage: 'GFC', count: 1 },
    ],
    Chennai: [{ stage: 'Concept', count: 1 }],
  };

  const bengaluruChart = projectsByStageChart(allBranches, byBranch, 'Bengaluru');
  assert.deepEqual(bengaluruChart.labels, ['Concept', 'GFC']);
  assert.deepEqual(bengaluruChart.datasets[0].data, [1, 1]);

  const chennaiChart = projectsByStageChart(allBranches, byBranch, 'Chennai');
  assert.deepEqual(chennaiChart.labels, ['Concept']);
  assert.deepEqual(chennaiChart.datasets[0].data, [1]);

  const allBranchesChart = projectsByStageChart(allBranches, byBranch, '');
  assert.deepEqual(allBranchesChart.labels, ['Concept', 'GFC']);
  assert.deepEqual(allBranchesChart.datasets[0].data, [2, 1]);
});
