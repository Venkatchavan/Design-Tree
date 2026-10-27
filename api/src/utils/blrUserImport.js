import { auditRoster } from './blrUserAudit.js';

// Called only by the explicit apply command. Existing identities are never changed.
export async function importRoster({ roster, User, Employee, passwordHash, roleKeys }) {
  const results = [];
  for (const row of roster) {
    // Re-read before each insert so a repeated input or completed prior run is skipped.
    const [users, employees] = await Promise.all([
      User.find({}).select('_id name email role isActive employee').lean(),
      Employee.find({}).select('_id firstName middleName lastName email user').lean(),
    ]);
    // Include the full input when detecting ambiguous names or shared emails.
    const review = auditRoster(roster, users, employees).rows[results.length];
    if (review.status !== 'missing_login' || !roleKeys.includes(row.role)) {
      results.push({ email: review.email, status: review.status === 'missing_login' ? 'review' : review.status });
      continue;
    }
    let employee, user;
    try {
      employee = await Employee.create({ firstName: row.name, email: review.email });
      user = await User.create({ name: row.name, email: review.email, passwordHash, role: row.role, employee: employee._id });
      employee.user = user._id;
      await employee.save();
      results.push({ email: review.email, status: 'created' });
    } catch (error) {
      // Compensate only the records created by this attempt; never delete pre-existing records.
      // A failed cleanup stops the batch rather than silently leaving it partially applied.
      if (user) await User.deleteOne({ _id: user._id, employee: employee?._id });
      if (employee) await Employee.deleteOne({ _id: employee._id });
      results.push({ email: review.email, status: 'failed', reason: error.code === 11000 ? 'Concurrent or duplicate identity detected; this attempt rolled back.' : 'Creation failed; this attempt rolled back.' });
    }
  }
  return results;
}
