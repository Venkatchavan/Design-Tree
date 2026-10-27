export function directoryPage(query) {
  const page = Number(query.page ?? 1);
  const requestedLimit = Number(query.limit ?? 200);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
    const error = new Error('Invalid directory pagination.');
    error.status = 400;
    throw error;
  }
  const limit = Math.min(requestedLimit, 200);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    const error = new Error('Invalid directory pagination.');
    error.status = 400;
    throw error;
  }
  return { page, limit, skip };
}
