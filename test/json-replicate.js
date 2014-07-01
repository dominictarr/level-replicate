var level    = require('level-test')()
var test     = require('tape')
var sublevel = require('level-sublevel')
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

test('json replicate', function (t) {
  var db1 = sublevel(level('json_replicate_1', {valueEncoding: 'json'}))
  var db2 = sublevel(level('json_replicate_2', {valueEncoding: 'json'}))

  var m1 = master(db1, 'master', "M1")
  var m2 = master(db2, 'master', "M2")

  series(
    put(db1, 'foo', {date: new Date()}),
    replicate(m1, m2),
    para(all (db1), all(db2))
  ) (function (err, all) {
      t.error(err)
      console.log(all)
      //assert that both databases are equal!
      t.deepEqual(all[0], all[1])
      t.end()
    })
})
