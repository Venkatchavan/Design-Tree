import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    allocationProject: {type:mongoose.Schema.Types.ObjectId,ref:'Project'},
    allocationService: String,
    name: { type: String, required: true, trim: true, index: true },
    service: { type: String, required: true, trim: true, index: true },
    branch: { type: String, trim: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    members: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Employee',
          required: true,
        },
        allocation: { type: String, trim: true },
        _id: false,
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

teamSchema.index({allocationProject:1,allocationService:1},{unique:true,partialFilterExpression:{allocationProject:{$type:'objectId'}}});

export const Team =
  mongoose.models.Team ?? mongoose.model('Team', auditProjectSchema(teamSchema));
