var pull   = require('pull-stream')
var pl     = require('pull-level')
var o      = require('observable')
var shasum = require('shasum')
var assert = require('assert')

var u = exports

exports.all = function all (db) {
  return function (cb) {
    pull(
      pl.read(db, {min: '\x00', max: '\xff\xff'}),
      pull.reduce(function (all, op) {
        all[op.key] = op.value
        return all
      }, {}, cb)
    )
  }
}

exports.slow = function (interval) {
  return pull.asyncMap(function (i, cb) {
    setTimeout(function () {
      cb(null, i)
    }, interval)
  })
}

exports.eventual = pull.Source(function (db, delay) {
  var _cb, timer, hash

  function queue () {
    clearTimeout(timer)
    timer = setTimeout(function () {
      u.all(db) (function (err, all) {
        if(_cb)
          _cb(null, shasum(all))
      })
    }, delay)
  }

  db.post(function () {
    hash = null
    queue()
  })

  queue()

  return function (abort, cb) {
    if(abort) {
      clearInterval(timer)
      cb(abort)
    }
    else if(hash) cb(null, hash)
    else _cb = cb
  }

})

exports.generate = function (db, opts) {
  return function (cb) {
    opts = opts || {}
    var count = opts.count || 10
    var create = opts.create || function () {
      return {key: (opts.prefix||'x')+Math.random(), value: new Date(), type: 'put'}
    }
    var interval = opts.interval || 1
    var delay = opts.delay || 100

    pull(
      pull.count(count),
      u.slow(interval),
      pull.map(create),
      pl.write(db, function (err) {
        if(err) throw err
        cb && cb()
      })
    )
  }
}

exports.observePull = function obPull (s) {
  var v = o()
  pull.drain(v) (s)
  return v
}

exports.eventuallyConsistent = function (d1, d2) {
  var h1, h2
  var consistent = o.compute([
    h1 = u.observePull(u.eventual(d1, 100)),
    h2 = u.observePull(u.eventual(d2, 100))
  ], function (h1, h2) {
    if(!h1 || !h2) return
    return h1 == h2
  })

  process.on('exit', function () {
    console.error(h1() + ' === ' + h2())
    assert.ok(consistent())
    assert.equal(h1(), h2())
  })
}

