
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

  //go through the logs in reverse,
  //get any values that have been over written,
  //group into batches, so it's more efficient communication with db,
  //and delete each set.

  db.cleanup = function (cb) {
    toPull(meta.createReadStream({reverse: true}))
      .pipe(pull.nonUnique(function (d) { return d.value.toString() })
      .pipe(pull.map(function () {
        return {key: d.key, type: 'del'}
      }))
      .pipe(pull.group(10))
      .pipe(pull.asyncMap(meta.batch.bind(meta)))
      .pipe(pull.drain(cb))
  })



  
}
