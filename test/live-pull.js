var levelup  = require('levelup')
var SubLevel = require('level-sublevel')
var net      = require('net')
var Master   = require('../')
var name     = require('random-name')
var pull     = require('pull-stream')
var help     = require('./helper')
var pl       = require('pull-level')
var zip      = require('pull-zip')

var rmrf = require('rimraf')

var path = '/tmp/test-level-master-live'
var _path = '/tmp/test-level-slave-live'
rmrf.sync(path)
rmrf.sync(_path)
var db = SubLevel(levelup(path))
var _db = SubLevel(levelup(_path))

var master = Master(db, 'master')
var slave  = Master.Slave(_db, 'slave')

slave.post(console.log.bind(console, '>'))

require('tape')('live replicate', function (t) {

master.createPullStream({tail: true})
.pipe(slave.createPullStream())

var i = 5
var int = setInterval(function () {
  if(!--i) {
    clearInterval(int)

    setTimeout(function () {

      zip([pl.read(db), pl.read(_db)])
      .pipe(pull.through(function (data) {
        console.log(data)
        t.deepEqual(data[0], data[1])
      }))
      .pipe(pull.onEnd(function () {

        help.hash(db, function (err, hash) {
          help.hash(_db, function (err, _hash) {
            t.equal(hash, _hash)
            t.end()
          })
        })
      }))

    }, 200)

    return
  }

  var key = Math.random().toString()
  var val = new Date().toString()

  db.put(key, val,
    function (err) {
  })

}, 200)

})
