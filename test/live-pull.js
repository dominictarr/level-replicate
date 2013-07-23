var levelup  = require('level-test')()
var SubLevel = require('level-sublevel')
var net      = require('net')
var Master   = require('../')
var name     = require('random-name')
var pull     = require('pull-stream')
var help     = require('./helper')
var pl       = require('pull-level')
var zip      = require('pull-zip')

var path = 'test-level-master-live'
var _path = 'test-level-slave-live'

var db = SubLevel(levelup(path))
var _db = SubLevel(levelup(_path))

var master = Master(db, 'master', 'TEST1')
var slave  = Master(_db, 'slave', 'TEST2')

slave.post(console.log.bind(console, '>'))

require('tape')('live replicate', function (t) {

  master.createMasterStream({tail: true})
  .pipe(pull.through(console.log.bind(console, '>')))
  .pipe(slave.createSlaveStream())

  db.post(console.log.bind(console))

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

    var key = 'rand_'+Math.random().toString()
    var val = new Date().toString()

    db.put(key, val, function (err) {
    })

  }, 200)

})
