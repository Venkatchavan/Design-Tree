import {
  DesignWorkflow,
  STEP_OWNERS,
  WORKFLOW_STEPS,
} from '../models/DesignWorkflow.js';
import { workflowStepsSchema } from '../validation/phase4.schema.js';

function withDefaults(doc) {
  const steps = WORKFLOW_STEPS.map((label, i) => {
    const saved = (doc?.steps ?? []).find((s) => s.n === i + 1);
    return {
      n: i + 1,
      label,
      owner: STEP_OWNERS[i],
      status: saved?.status ?? 'Not Started',
      remarks: saved?.remarks ?? '',
      date: saved?.date ?? null,
    };
  });
  return {
    project: doc?.project ?? null,
    steps,
    matrix: doc?.matrix ?? [],
    updatedAt: doc?.updatedAt ?? null,
  };
}

export async function getWorkflow(req, res, next) {
  try {
    const doc = await DesignWorkflow.findOne({ project: req.query.project });
    return res.status(200).json({ item: withDefaults(doc) });
  } catch (err) {
    return next(err);
  }
}

export async function saveWorkflow(req, res, next) {
  const parsed = workflowStepsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await DesignWorkflow.findOneAndUpdate(
      { project: parsed.data.project },
      {
        project: parsed.data.project,
        steps: parsed.data.steps.map((s) => ({
          ...s,
          updatedBy: req.user.id,
        })),
        matrix: parsed.data.matrix ?? [],
      },
      { upsert: true, new: true, returnDocument: 'after', runValidators: true },
    );
    return res.status(200).json({ item: withDefaults(doc) });
  } catch (err) {
    return next(err);
  }
}

export function workflowMeta(_req, res) {
  return res.status(200).json({ steps: WORKFLOW_STEPS, owners: STEP_OWNERS });
}
