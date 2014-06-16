var level    = require('level-test')()
var test     = require('tape')
var sublevel = require('level-sublevel')
var pl       = require('pull-level')
var pull     = require('pull-stream')
var para     = require('continuable-para')
var series   = require('continuable-series')

var master   = require('../')

var all      = require('./util').all

function put (db, key, value) {
  return function (cb) {
    db.put(key, value, cb)
  }
}

function replicate (m1, m2) {
  return function (cb) {
    m1.createMasterStream()
      .pipe(m2.createSlaveStream(cb))
  }
}

test('replicate sublevels 1', function (t) {
  var db1 = sublevel(level('replicate_1'))
  var db2 = sublevel(level('replicate_2'))

  var sub1 = db1.sublevel('sub1').sublevel('sub2')

  var m1 = master(db1, 'master', "M1", {recursive: true})
  var m2 = master(db2, 'master', "M2", {recursive: true})

  series(
    put(sub1, 'foo', new Date()),
    replicate(m1, m2),
    para(all(db1), all(db2))
  )(function (err, all) {
    console.log('err', err)
    t.notOk(err)
    //assert that both databases are equal!
    console.log(all)
    t.deepEqual(all[0], all[1])
    t.end()
  })
})
