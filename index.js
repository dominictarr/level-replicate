
var timestamp = require('monotonic-timestamp')
var pull      = require('pull-stream')
var ClassicStream
              = require('pull-stream-to-stream')
var serialize = require('stream-serializer')()
var window    = require('pull-window')
var pl        = require('pull-level')

exports = module.exports = function (db, master) {

  master = master || 'master'
  if('string' === typeof master)
    master = db.sublevel(master)

  //ADD A LOG THAT POINTS TO WHICH KEYS WHERE UPDATED WHEN.
  
  db.pre(function (ch, add) {
    add({key: timestamp(), value: ch.key, type: 'put'}, master)
  })  

  //cleanup old records.
  //run this every so often if you have lots of overwrites.

  //go through the logs in reverse,
  //get any values that have been over written,
  //group into batches, so it's more efficient communication with db,
  //and delete each set.

  master.cleanup = function (cb) {
      pl.read(db, {reverse: true})
      .pipe(pull.nonUnique(function (d) {
        return d.value.toString()
      }))
      .pipe(pull.map(function () {
        return {key: d.key, type: 'del'}
      }))
      .pipe(pl.write(db, cb))
  }

  master.createStream = function (opts) {
    var defer = pull.defer()
    var cs = ClassicStream(function (read) {
        read(null, function (err, data) {
          defer.resolve(master.createPullStream({
            start: String(data.since || 0),
            tail: opts.tail
          }))
        })
      }, defer)

    cs.on('close', function () {
      console.log('CLOSE')
    })

    return serialize(cs)//.on('data', console.log)
  }

  master.createPullStream = function (opts, onAbort) {
    opts = opts || {}
    var since = opts.since || 0
    opts.min = since
    
    //read a header, and then send the data...
    return pl.read(master, opts)
      .pipe(pull.filter(function (data) {
        return (
          since < data.key
          && !!data.value
        ) //filter deletes, this is just cleaning up!
      }))
      .pipe(pull.asyncMap(function (data, cb) {
  //       console.log('data', data)
         db.get(data.value, function (err, value) {
//            console.log('<--', data.value, value, Date.now())
            cb(null, {
              key: data.value,
              value: value,
              type: err ? 'del' : 'put',
              ts: data.key
            })
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
  return master
}


exports.slave = exports.Slave = function (db, slave) {

  slave = slave || 'slave'
  if('string' === typeof slave)
    slave = db.sublevel(slave)

  slave.since = function (cb) {
    slave.get('seq', function (err, val) {
      cb(null, Number(val) || 0)
    })
  }

  slave.createStream = function () {
    var cs = serialize(ClassicStream())
    cs.source.pipe(
      slave.createPullStream(function (err) {
        if(err) cs.emit('error')
        else cs.emit('close')
    }))
    var first = true
    cs.sink(function (end, cb) {
      if(!first) return
      first = true
      slave.since(function (err, ts) {
        cb(null, {since: ts})
      })
    })
    return cs
  }

  slave.createPullStream = function (done) {
  return window(10, 100) //read from remote MASTER
      .pipe(pull.map(function (batch) {
        var max = 0
        batch.forEach(function (e) {
          if(e.ts > max)
            max = e.ts
        })
        batch.push({
          type: 'put', key: slave.prefix('seq'), value: max
        })
        return batch
      }))
      .pipe(pull.asyncMap(function (batch, cb) {
        db.batch(batch, function (err) {
//          console.log('saved', batch)
          cb(err, batch)
        })
      }))
      .pipe(pull.drain(null, done))
  }
  return slave
}
