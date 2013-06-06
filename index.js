var timestamp = require('monotonic-timestamp')
var pull      = require('pull-stream')
var ClassicStream
              = require('pull-stream-to-stream')
var serialize = require('stream-serializer')()
var window    = require('pull-window')
var pl        = require('pull-level')
var merge     = require('pull-stream-merge')
var cat       = require('pull-cat')
var lookup    = require('./lookup')

function each (obj, iter) {
  for(var key in obj) {
    iter(obj[key], key, obj)
  }
}

function map (obj, iter) {
  var a = []
  for(var k in obj)
    a.push(iter(obj[k], k, obj))
  return a
}

function find (ary, test) {
  for(var i in ary)
    if(test(ary[i], i, ary)) return ary[i]
}

function filterReverse (ary, test) {
  var l = ary.length, a = []
  while(l--)
    if(test(ary[l], l, ary)) a.unshift(ary[l])

  return a
}

function flatten (ary) {
  return ary.reduce(function (ary, _ary) {
    return ary.concat(_ary)
  }, [])

}

function cmp (a, b) {
  return a === b ? 0 : a < b ? -1 : 1
}

function comparator(a, b) {
  return cmp(a.ts, b.ts) || cmp(a.id, b.id)
}

function prep () {
  return pull.map(function (data) {
    var key = data.key.split('!')
    return {
      key: data.value,
      value: null,
      type: null,
      id: key.shift(),
      ts: key.pop()
    }
  })
}

exports = module.exports = function (db, masterDb, id) {

  masterDb = masterDb || 'master'
  if('string' === typeof masterDb)
    masterDb = db.sublevel(masterDb)
  var clockDb = masterDb.sublevel('clock')

  //ADD A LOG THAT POINTS TO WHICH KEYS WHERE UPDATED WHEN.
  
  db.pre(function (op, add, batch) {
    if(!find(batch, function (_op) {
        return _op.value === op.key && _op.prefix === masterDb
      })
    ) {
      var ts = timestamp()
      add({key: id+'!'+ts, value: op.key, type: 'put', prefix: masterDb})
      add({key: id, value: ''+ts, type: 'put', prefix: clockDb})
    }
  })

  //cleanup old records.
  //run this every so often if you have lots of overwrites.

  //go through the logs in reverse,
  //get any values that have been over written,
  //group into batches, so it's more efficient communication with db,
  //and delete each set.

  var clock = {}

  masterDb.cleanup = function (cb) {
    pl.read(db, {reverse: true})
    .pipe(pull.nonUnique(function (d) {
      return d.value.toString()
    }))
    .pipe(pull.map(function () {
      return {key: d.key, type: 'del'}
    }))
    .pipe(pl.write(db, cb))
  }

  masterDb.createStream = function (opts) {
    var defer = pull.defer()
    var cs = ClassicStream(function (read) {
        read(null, function (err, data) {
          defer.resolve(masterDb.createMasterStream({
            min: String(id+'!'+(data.since || 0)),
            tail: opts.tail
          }))
        })
      }, defer)

    return serialize(cs)
  }

  masterDb.createStream = function () {
    var defer = pull.defer()
    var cs = ClassicStream(function (read) {
        read(null, function (err, data) {
          defer.resolve(masterDb.createMasterStream({
            min: String(id+'!'+(data.since || 0)),
            tail: opts.tail
          }))
        })
      }, defer)

    return serialize(cs)
  }
  
  masterDb.createMasterStream = pull.Source(function (opts, onAbort) {
    opts = opts || {}
    opts.clock = opts.clock || {}
    var since = opts.min || opts.since || 0

    function rest (clock) {

      var nClock = {}
      each(clock, function (_, key) {
        nClock[key] = 0
      })

      each(opts.clock, function (value, key) {
        if(nClock[key] < value)
          nClock[key] = value
      })

      return cat([
        merge(map(nClock, function (value, key) {
          return {min: key + '!' + value, max: key+'!~', tail: false}
        }).map(function (opts) {
          return pl.read(masterDb, opts)
            //can remove this once level gets exclusive ranges!
            .pipe(prep())
            .pipe(pull.filter(function (data) {
              var c = nClock[data.id]
              return !c || (c < data.ts) && !!data.key
            }))
        }), comparator),
        opts.tail ? pl.live(masterDb).pipe(prep()) : pull.empty()
      ])
      .pipe(pull.asyncMap(function (data, cb) {
         db.get(data.key, function (err, value) {
            data.value = value
            data.type = err ? 'del' : 'put'
            cb(null, data)
          })
      }))
      .pipe(function (read) {
        if(!onAbort) return read
        return function (abort, cb) {
          if(abort)
            onAbort(abort === true ? null : abort) 

          read(abort, function (err, data) {
            if(err) onAbort(err === true ? null : err)
            cb(err, data)
          })
        }
      })
    }

    var read

    return function (abort, cb) {
      if(!read)
        masterDb.clock(function (err, nClock) {
          if(err) return cb(err)
          ;(read = rest(nClock))(abort, cb)
        })
      else
        read(abort, cb)
    }
  })

  masterDb.clock = function (cb) {
    pl.read(clockDb)
      .pipe(pull.reduce(function (clock, item) {
        clock[item.key] = item.value
        return clock
      }, {}, cb))
  }


  //TODO: defer opening database until this is loaded!
  //this requires a patch to level!
  masterDb.clock(function (err, _clock) {
    each(clock, function (ts, id) {
      if(clock[id] < ts)
        clock[id] = ts
    })
  })

  clockDb.post(function (op) {
    if(clock[op.key] < op.value)
      clock[op.key] = op.value
  })

  //the writable side of the replication stream.

  masterDb.createSlaveStream = function (opts, done) {
    if('function' === typeof opts) {
      done = opts; opts = null
    }

    return pull.map(function (op) {

      if(clock[op.id] > op.ts) return

      return [
        op,
        {key: op.id+'!'+op.ts, value: op.key, type: 'put', prefix: masterDb},
        {key: op.id, value: op.ts, type: 'put', prefix: clockDb}
      ]

    }).pipe(pull.filter(Boolean))
    .pipe(pull.map(function (batch) {

      var seen = {}
      //make sure there is only one clock update per batch
      batch = filterReverse(batch, function (op) {
        if(op.prefix !== clockDb) return true
        else if (!seen[op.key])    return seen[op.key] = true
        return false
      })
      return batch
    }))
    .pipe(pull.asyncMap(function (batch, cb) {
      db.batch(batch, function (err) {
        cb(err, !!batch)
      })
    }))
    .pipe(function (read) {
      read(null, function next(end, data) {
        if(end) done()
        else read(null, next)
      })
    })
    //currently not sure why this isn't working...
    //.pipe(pull.drain(null, done))
  }

  return masterDb
}
