
var timestamp = require('monotonic-timestamp')
var pull      = require('pull-stream')
var toPull    = require('stream-to-pull-stream')

var module.exports = function (db, meta) {

  meta = meta || 'master'

  if('string' === typeof meta)
    meta = db.sublevel(meta)

  //ADD A LOG THAT POINTS TO WHICH KEYS WHERE UPDATED WHEN.
  db.pre(function (ch, add) {
    add({key: timestamp(), value: ch.key, prefix: meta})
  })

  //cleanup old records.
  //run this every so often if you have lots of overwrites.

  //handle a number of elements as a batch.

  db.cleanup = function (cb) {
    var seen = {}
    var delete = []
    var deleting = false
    var ended    = false
    var delEnded = false
    var n = 0

    function drainDeletes (ts) {
      if(ts) {
        delete.push({key: ts, type: 'del'})
        n ++
      }
      if(deleting) return
      deleting = true

      process.nextTick(function () {
        var _delete = delete
        delete = []
        meta.batch(_delete, function () {
          deleting = false
          n -= _delete.length

          if(delete.length)
            drainDeletes()
          else if(ended && !n)
            cb && cb()
          
        })
      })
    }

    meta.createReadStream({reverse: true})
    .on('data', function (data) {
      var key = data.value.toString()
      var ts  = data.key.toString()
      if(seen[key])
        drainDeletes(ts)
    })
    .on('end', function () {
      ended = true
      if(!n) cb && cb()
    })

  })

  db.createStream = function (opts) {
    

  }

  
}
