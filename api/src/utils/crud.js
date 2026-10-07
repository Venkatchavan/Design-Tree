// Tiny CRUD factory for straightforward Phase 2 resources.
// makeCrud(Model, { create, update, filters(req)->filter, populate })
export function makeCrud(Model, opts = {}) {
  return {
    async list(req, res, next) {
      try {
        const filter = opts.filters ? opts.filters(req) : {};
        let q = Model.find(filter).sort({ createdAt: -1 }).limit(200);
        if (opts.populate) q = q.populate(opts.populate);
        const [items, total] = await Promise.all([
          q,
          Model.countDocuments(filter),
        ]);
        return res.status(200).json({ items, total });
      } catch (err) {
        if (err?.code === 11000) {
          return res.status(409).json({ message: 'A record with these fields already exists.' });
        }
        return next(err);
      }
    },
    async get(req, res, next) {
      try {
        let q = Model.findById(req.params.id);
        if (opts.populate) q = q.populate(opts.populate);
        const doc = await q;
        if (!doc) return res.status(404).json({ message: 'Not found.' });
        return res.status(200).json({ item: doc });
      } catch (err) {
        return next(err);
      }
    },
    async create(req, res, next) {
      try {
        if (opts.create) {
          const parsed = opts.create.safeParse(req.body);
          if (!parsed.success) {
            return res.status(400).json({ message: 'Invalid data.' });
          }
          req.body = opts.decorate
            ? await opts.decorate(parsed.data, req)
            : parsed.data;
        }
        const doc = await Model.create(req.body);
        return res.status(201).json({ item: doc });
      } catch (err) {
        return next(err);
      }
    },
    async update(req, res, next) {
      try {
        if (opts.update) {
          const parsed = opts.update.safeParse(req.body);
          if (!parsed.success) {
            return res.status(400).json({ message: 'Invalid data.' });
          }
          req.body = parsed.data;
        }
        const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
          new: true,
          returnDocument: 'after',
          runValidators: true,
        });
        if (!doc) return res.status(404).json({ message: 'Not found.' });
        return res.status(200).json({ item: doc });
      } catch (err) {
        return next(err);
      }
    },
  };
}
