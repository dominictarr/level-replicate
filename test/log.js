
var path = '/tmp/test-level-master'
var path2 = '/tmp/test-level-slave'

require('rimraf').sync(path)
require('rimraf').sync(path2)

var levelup = require('levelup')
var SubLevel = require('level-sublevel')

var db     = SubLevel(levelup(path))
var _db    = SubLevel(levelup(path2))

var Master = require('../')
var pull   = require('pull-stream')
var toPull = require('stream-to-pull-stream')
var zip    = require('pull-zip')
var pl = require('pull-level')


var help   = require('./helper')
var test   = require('tape')

var master = Master(db, 'master')

slave = Master.Slave(_db)

test('setup', function (t) {
  help.populate(db, 20, function () {
    t.end()
  })
})

test('createPullStream', function (t) {
  //replicate!

  master.createPullStream()
  .pipe(pull.through(console.log))
  .pipe(slave.createPullStream(function (err) {

    if(err) throw err
    
    zip(pl.read(db), pl.read(_db))
    .pipe(pull.through(function (data) {
      t.deepEqual(data[0], data[1])
    }))
    .pipe(pull.onEnd(function () {

      help.hash(_db, function (err, hash) {
        if(err) throw err
        help.hash(db, function (err, _hash) {
          if(err) throw err
          t.equal(hash, _hash)
          t.end()
        })
      })

    }))
    
    //t.end()
  }))
})

//master-slave replication must pull from master.
//connect to master, copy current since value.


