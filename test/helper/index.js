var pc     = require('pull-crypto')
var pull   = require('pull-stream')
var toPull = require('stream-to-pull-stream')
var name   = require('random-name')

exports.populate = 
function (db, n, cb) {
  pull.infinite(name)
  .pipe(pull.take(n))
  .pipe(pull.map(function (name) {
    return {key: name, value: new Date(), type: 'put'}
  }))
  .pipe(pull.group(24))
  .pipe(pull.asyncMap(function (data, cb) {
      db.batch(data, function (err) {
        process.nextTick(cb)
      })
    }))
  .pipe(pull.onEnd(function (err) {
    console.log(err, cb)
    cb(err)
  }))
}

exports.hash = function (db, cb) {
  toPull(db.createReadStream())
  .pipe(pull.map(function (data) {
    return [data.key, data.value]
  }))
  .pipe(pull.flatten())
  .pipe(pc.hash(cb))
}

