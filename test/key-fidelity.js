var levelup = require('level-test')()
  , replicate = require('../')
  , sublevel = require('level-sublevel')
  , test = require('tape')
  , opts = {keyEncoding: 'utf8', valueEncoding: 'json', clean: false}

var db1, db2, m1, m2;

// necessary to clean up databases before test
test('setup', function (t) {
  db1 = sublevel(levelup('key-fidelity_db1'))
  db2 = sublevel(levelup('key-fidelity_db2'))
  db1.close(function(){
    db2.close(function(){
      t.end()
    })
  })
})

test('fills', function (t) {
  db1 = sublevel(levelup('key-fidelity_db1', opts))
  db2 = sublevel(levelup('key-fidelity_db2', opts))
  m1 = replicate(db1, 'master', 'M1')
  m2 = replicate(db2, 'master', 'M2')

  // add one document
  db1.put('foo', {bar: 'baz'}, function (err) {
    if (err) console.log('err', err);
    db1.close(function(){ db2.close(function(){ t.end() }) })
  });
})

// store the data that is sent from one master to the other
var wireData = {}

run = function (key, expectedWireCalls) {
  test('replicates', function (t) {
    db1 = sublevel(levelup('key-fidelity_db1', opts))
    db2 = sublevel(levelup('key-fidelity_db2', opts))
    m1 = replicate(db1, 'master', 'M3')
    m2 = replicate(db2, 'master', 'M4')

    // replicate databases
    var m1s = m1.createStream({tail: true})
    var m2s = m2.createStream({tail: true})

    m1s.pipe(m2s).pipe(m1s)
    m1s.on('data', function(data){
      wireData[key] = wireData[key] || {};
      wireData[key][data] = true;
    })

    var wireCallTimes = 1;

    m2s.on('data', function () {
      console.log('data', wireCallTimes, expectedWireCalls)
      if (wireCallTimes < expectedWireCalls) return wireCallTimes++;
      // collect result
      var db1result = ''
      var db2result = ''

      var s1 = db1.createReadStream()
      var s2 = db2.createReadStream()

      s1.on('data', function(data){ db1result += JSON.stringify(data) })
      s2.on('data', function(data){ db2result += JSON.stringify(data) })

      s2.on('end', done)
      s1.on('end', done)

      var doneTimes = 0
      function done() {
        if (doneTimes < 1) return doneTimes++;
        console.log('done', doneTimes)

        t.ok(db1result, 'db1 has content')
        t.equal(db1result, db2result, 'contents matches')

        db1.close(function(){ db2.close(function(){ t.end() }) })
      }
    })
  })
}

// replicate several times
run('1', 2)
run('2', 1)
run('3', 1)
run('4', 1)

test('only info about key "foo" is sent', function(t){
  keys = []
  for (k in wireData) {
    for (kk in wireData[k]) {
      var obj = JSON.parse(kk)
      console.log('result:', k, obj)
      // ignore anything without 'key' set
      if (obj.key) keys.push(obj.key);
    }
  }
  // there should be only one key: foo
  console.log('result:', keys)
  t.equal(keys.length, 1)
  t.equal(keys[keys.length-1], 'foo')
  t.end()
})
