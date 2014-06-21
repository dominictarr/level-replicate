var timestamp = require('monotonic-timestamp')
var pull      = require('pull-stream')
var ClassicStream
              = require('pull-stream-to-stream')
var window    = require('pull-window')
var pl        = require('pull-level')
var merge     = require('pull-stream-merge')
var cat       = require('pull-cat')

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

//function filterReverse (ary, test) {
//  var l = ary.length, a = []
//  while(l--)
//    if(test(ary[l], l, ary)) a.unshift(ary[l])
//
//  return a
//}

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
    var key = data.key.split('\x00')
    return {
      key: data.value,
      value: null,
      type: null,
      id: key.shift(),
      ts: key.pop()
    }
  })
}

function pCont (continuable) {
  var n = -1
  return function (abort, cb) {
    if(abort) return cb(true)
    if(++n)   return cb(n === 1 ? true : new Error('only call once'))
    continuable(cb)
  }
}

function getPrefix (op) {
  if (typeof op.prefix === 'string') return op.prefix
  if (typeof op.prefix === 'function') return op.prefix()
  if (typeof op.prefix === 'object') return op.prefix.prefix()
  return null
}

module.exports = function (serialize) {

return function (db, masterDb, id, options) {
  options = options || {}
  options.recursive = options.recursive || false

  var clock = {} //remember latest version from each dep.

  masterDb = masterDb || 'master'
  if('string' === typeof masterDb)
    masterDb = db.sublevel(masterDb, {keyEncoding: 'utf8', valueEncoding: 'utf8'})
  var clockDb = masterDb.sublevel('clock', {keyEncoding: 'utf8', valueEncoding: 'utf8'})

  //on insert, remember which keys where updated when.
  if (options.recursive) {
    db.pre({start: '\x00', end: '\xff\xff', safe: false}, preHook)
  } else {
    db.pre(preHook)
  }

  function preHook (op, add, batch) {
    var prefix = masterDb.prefix()

    var opPrefix = getPrefix(op)
    if (opPrefix && opPrefix.indexOf(prefix) === 0) return

    if(!find(batch, function (_op) {
        return _op.value === op.key && _op.key.indexOf(prefix) === 0
      })
    ) {
      var ts = timestamp()
      add({key: id+'\x00'+ts, value: op.key, type: 'put', prefix: masterDb,
        valueEncoding: 'utf8', keyEncoding: 'utf8'
      })
      add({key: id, value: ''+ts, type: 'put', prefix: clockDb,
        valueEncoding: 'utf8', keyEncoding: 'utf8'
      })
    }
  }

  //cleanup old records.
  //run this every so often if you have lots of overwrites.

  //go through the logs in reverse,
  //get any values that have been over written,
  //group into batches, so it's more efficient communication with db,
  //and delete each set.

  masterDb.cleanup = function (cb) {
    pull(
      pl.read(db, {reverse: true}),
        pull.nonUnique(function (d) {
        return d.value.toString()
      }),
      pull.map(function (d) {
        return {key: d.key, type: 'del'}
      }),
      pl.write(db, cb)
    )
  }

  masterDb.createStream = function (opts) {
    var defer = pull.defer()
    var cs = ClassicStream(function (read) {
        read(null, function (err, data) {
          defer.resolve(masterDb.createMasterStream({
            clock: data,
            tail: opts && opts.tail
          }))
          pull(read, masterDb.createSlaveStream())
        })
      }, cat([pCont(masterDb.clock), defer]))

    return serialize(cs)
  }

  masterDb.createMasterStream = pull.Source(function (opts, onAbort) {
    opts = opts || {}
    opts.clock = opts.clock || {}
    var since = opts.min || opts.since || 0

    function rest (nClock) {
      return pull(
        cat([
          merge(map(nClock, function (value, key) {
            return {min: key + '\x00' + value, max: key+'\x00\xff', tail: opts.tail}
          }).map(function (opts) {
            //can remove this once level gets exclusive ranges!
            return pull(pl.read(masterDb, opts), prep())
          }), comparator),
          (opts.tail ? pull(pl.live(masterDb), prep()) : pull.empty())
        ]),
        pull.filter(function (data) {
          var c = nClock[data.id]
          if(!data.key) return false
          if(!c || c < data.ts) {
            nClock[data.id] = data.ts
            return true
          }
          return false
        }),
        //lookup actual values
        pull.asyncMap(function (data, cb) {
          db.get(data.key, function (err, value) {
            data.value = value
            data.type = err ? 'del' : 'put'
            cb(null, data)
          })
        }),
        function (read) {
          if(!onAbort) return read
          return function (abort, cb) {
            if(abort)
              onAbort(abort === true ? null : abort)

            read(abort, function (err, data) {
              if(err) onAbort(err === true ? null : err)
              cb(err, data)
            })
          }
        }
      )
    }

    var read
    return function (abort, cb) {
      if(!read)
        masterDb.clock(function (err, clock) {
          if(err) return cb(err)

          var nClock = {}
          each(clock, function (_, key) {
            nClock[key] = 0
          })

          each(opts.clock, function (value, key) {
            if(nClock[key] < value)
              nClock[key] = value
          })

          ;(read = rest(nClock))(abort, cb)
        })
      else
        read(abort, cb)
    }
  })

  masterDb.clock = function (cb) {
    pull(
      pl.read(clockDb),
      pull.reduce(function (clock, item) {

        clock[item.key] = item.value
        return clock
      }, {}, cb)
    )
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

    return pull(
      pull.map(function (op) {
        if(clock[op.id] > op.ts) return
        return [
          op,
          {
            key: op.id+'\x00'+op.ts,
            value: op.key, type: 'put',
            prefix: masterDb,
            keyEncoding: 'utf8',
            valueEncoding: 'utf8'
          },
          {
            key: op.id,
            value: op.ts,
            type: 'put',
            prefix: clockDb,
            keyEncoding: 'utf8',
            valueEncoding: 'utf8'
          }
        ]
      }),
      pull.filter(Boolean),
      pull.asyncMap(function (batch, cb) {
        db.batch(batch, function (err) {
          cb(err, !!batch)
        })
      }),
      function (read) {
        read(null, function next(end, data) {
          if(end) done && done()
          else    read(null, next)
        })
      }
    )
    //currently not sure why this isn't working...
    //.pipe(pull.drain(null, done))
  }

  return masterDb
}

}
