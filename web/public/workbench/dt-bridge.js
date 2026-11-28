// DesignTree bridge for the IS Design Workbench (28 Nov 2026). The workbench asks
// window.claude.use('db' | 'user') for storage and the signed-in user; this file
// answers both from /api/workbench (same cookie login as DesignTree), so work is
// saved for the whole DT Peer Review team and the rights follow the user's role.
(function () {
  var API = '/api/workbench';
  var POLL_MS = 8000;

  function call(method, url, body) {
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var e = new Error(data.message || 'Request failed (' + res.status + ')');
          e.code = res.status === 403 ? 'permission_denied' : res.status === 401 ? 'unauthenticated' : 'error_' + res.status;
          throw e;
        }
        return data;
      });
    });
  }

  var mePromise = call('GET', API + '/me').then(function (me) {
    window.__DTWB = { canWrite: !!me.canWrite, canApprove: !!me.canApprove, name: me.name };
    return me;
  });

  // Snapshot listeners, refreshed after every write and on a short poll so other
  // reviewers' changes show up without a reload.
  var listeners = [];
  function refresh(l) {
    var p = l.kind === 'doc'
      ? call('GET', API + '/doc?path=' + encodeURIComponent(l.path)).then(function (d) {
          return { key: JSON.stringify(d), snap: { exists: d.exists, data: function () { return d.data; } } };
        })
      : call('GET', API + '/col?path=' + encodeURIComponent(l.path) + (l.order ? '&orderBy=' + l.order + '&dir=' + l.dir : '') + (l.limit ? '&limit=' + l.limit : '')).then(function (d) {
          return { key: JSON.stringify(d), snap: { docs: d.docs.map(function (x) { return { id: x.id, data: function () { return x.data; } }; }) } };
        });
    return p.then(function (r) {
      if (!l.live || r.key === l.last) return;
      l.last = r.key;
      l.cb(r.snap);
    }, function (e) { if (l.live && l.err && l.last === undefined) l.err(e); });
  }
  function refreshAll() { listeners.forEach(refresh); }
  setInterval(function () { if (!document.hidden) refreshAll(); }, POLL_MS);
  function listen(spec, cb, err) {
    var l = Object.assign({ cb: cb, err: err, live: true }, spec);
    listeners.push(l);
    refresh(l);
    return function () { l.live = false; listeners = listeners.filter(function (x) { return x !== l; }); };
  }
  function query(path, order, dir, limit) {
    return {
      orderBy: function (f, d) { return query(path, f, d || 'asc', limit); },
      limit: function (n) { return query(path, order, dir, n); },
      onSnapshot: function (cb, err) { return listen({ kind: 'col', path: path, order: order, dir: dir, limit: limit }, cb, err); },
    };
  }
  var db = {
    collection: function (path) { return query(path); },
    doc: function (path) {
      return {
        set: function (data) { return call('PUT', API + '/doc', { path: path, data: data }).then(refreshAll); },
        delete: function () { return call('DELETE', API + '/doc?path=' + encodeURIComponent(path)).then(refreshAll); },
        onSnapshot: function (cb, err) { return listen({ kind: 'doc', path: path }, cb, err); },
      };
    },
  };
  var user = {
    id: function () { return mePromise.then(function (m) { return m.id; }); },
    can: function (what) { return mePromise.then(function (m) { return what === 'data.write' ? !!m.canWrite : false; }); },
    profiles: function (ids) { return call('POST', API + '/profiles', { ids: ids }); },
  };

  window.claude = window.claude || {};
  window.claude.use = function (name) {
    if (name === 'db') return mePromise.then(function () { return db; });
    if (name === 'user') return mePromise.then(function () { return user; });
    return Promise.resolve(null);
  };
})();
