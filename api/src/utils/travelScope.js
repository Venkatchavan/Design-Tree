import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { TravelBooking } from '../models/TravelBooking.js';

// Employee records saved against a login, through either link direction.
export async function travellerEmployeeIds(userId) {
  if (!userId) return [];
  const [user, linked] = await Promise.all([
    User.findById(userId).select('employee').lean().catch(() => null),
    Employee.find({ user: userId }).select('_id').lean().catch(() => []),
  ]);
  const ids = new Set(linked.map((e) => String(e._id)));
  if (user?.employee) ids.add(String(user.employee));
  return [...ids];
}

// Employee ids of the login that are the traveller on at least one saved
// booking. Empty when the login has never been booked for travel.
export async function travellerScope(userId) {
  const ids = await travellerEmployeeIds(userId);
  if (!ids.length) return [];
  return (await TravelBooking.exists({ employee: { $in: ids } })) ? ids : [];
}

export async function isTraveller(userId) {
  return (await travellerScope(userId)).length > 0;
}
