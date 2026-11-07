import mongoose from 'mongoose';

// Daily sign-in / sign-out record backing the late-login (after 9:45 IST)
// and early-logout (under 8 hours) reason rules. One doc per employee-day;
// first login of the day wins so re-logins don't reset `loginAt`.
const attendanceDaySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    // IST calendar day key: YYYY-MM-DD.
    date: { type: String, required: true, trim: true, index: true },
    loginAt: { type: Date, default: null },
    logoutAt: { type: Date, default: null },
    // Required when loginAt is after 9:45 IST on a working day.
    lateReason: { type: String, trim: true, default: null },
    // Required when (logoutAt - loginAt) is under 8 hours.
    earlyLogoutReason: { type: String, trim: true, default: null },
    // Required when (logoutAt - loginAt) exceeds 8 hours. The reporting
    // TL / PTL (or mapped director) then approves or declines it.
    extraHoursReason: { type: String, trim: true, default: null },
    extraHours: { type: Number, min: 0, default: null },
    extraHoursStatus: { type: String, enum: ['pending', 'approved', 'declined'], default: null, index: true },
    // Approver's remark: mandatory when approving AND when declining.
    extraHoursDecisionReason: { type: String, trim: true, default: null },
    extraHoursDecidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    extraHoursDecidedAt: { type: Date },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    // Sunday / Holiday logins carry no late-login reason, but the whole session is
    // extra hours: a reason at sign-out, then TL / PTL approval.
    workingDay: { type: Boolean, default: true },
  },
  { timestamps: true },
);

attendanceDaySchema.index({ employee: 1, date: 1 }, { unique: true });

export const AttendanceDay =
  mongoose.models.AttendanceDay ??
  mongoose.model('AttendanceDay', attendanceDaySchema);
