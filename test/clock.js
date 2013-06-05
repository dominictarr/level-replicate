
var level    = require('level-test')()
var test     = require('tape')
var sublevel = require('level-sublevel')
var master   = require('../')

process.on('uncaughtException', console.error)

test('vector clock', function (t) {
  var db = sublevel(level('vectorClock'))

  var masterDb = master(db, 'master', 'TEST')

  var ts = Date.now()

  db.put('foo', 'bar', function (err) {
    t.notOk(err)

    masterDb.clock(function (err, clock) {
      t.notOk(err)
      t.ok(clock.TEST > ts)
      console.log(clock)
      t.end()
    })
  })
})

//add more tests once there are multiple databases that can replicate.
